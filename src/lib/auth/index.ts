// src/lib/auth/index.ts
// NextAuth.js v5 configuration (App Router) - JWT strategy

import { triggerInitialBuild } from "@/actions/extensions/builds";
import { prisma } from "@/lib/db";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cache } from "react";

/** Apple sign-in is enabled only when both env vars are present (6.1). */
export function isAppleSignInEnabled(): boolean {
  return Boolean(
    process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
  );
}

function optionalProviders(): NextAuthConfig["providers"] {
  if (!isAppleSignInEnabled()) return [];
  return [
    Apple({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ];
}

/**
 * Token refresh lookup, de-duplicated per request. Every `auth()` call runs the
 * JWT callback, and a single page render calls `auth()` from many server
 * components and actions; without this each call re-read the same user row.
 */
const loadTokenUser = cache(async (email: string) =>
  prisma.user.findUnique({
    where: { email },
    select: { id: true, organizationId: true, role: true, teamId: true },
  })
);

/**
 * NextAuth.js v5 configuration
 * - Google OAuth provider
 * - Credentials provider (email/OTP)
 * - Prisma adapter (DB integration)
 * - JWT session strategy (Edge Runtime support)
 * - Adds organizationId and role to the session
 */

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true, // Required when running behind a proxy such as Vercel
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true, // Allow linking accounts of invited users
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "Verification code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.otp) {
          return null;
        }

        const email = credentials.email as string;
        const otp = credentials.otp as string;

        // Look up the user (invite-only: must already exist in the DB)
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        });

        if (!user) return null;

        // Look up an active (unexpired) OTP token
        const otpToken = await prisma.otpToken.findFirst({
          where: {
            email,
            expires: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!otpToken) return null;

        // Delete the token once the maximum attempts are exceeded
        if (otpToken.attempts >= 5) {
          await prisma.otpToken.delete({ where: { id: otpToken.id } });
          return null;
        }

        // Compare the OTP code
        if (otpToken.code !== otp) {
          await prisma.otpToken.update({
            where: { id: otpToken.id },
            data: { attempts: { increment: 1 } },
          });
          return null;
        }

        // Success: delete the token (single-use)
        await prisma.otpToken.delete({ where: { id: otpToken.id } });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    ...optionalProviders(),
  ],
  // JWT session strategy (works on the Edge Runtime)
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    /**
     * JWT callback: stores user info in the token
     * Note: also invoked on the Edge Runtime (middleware), so check the environment before calling Prisma
     */
    async jwt({ token, user, trigger, account }) {
      // JWT Callback log removed

      // On first sign-in (OAuth callback - runs only in the server environment)
      if (user && account && user.id) {
        token.id = user.id;

        // Query the DB and update lastLoginAt only on initial sign-in
        try {
          // Update the login time (findUnique + update combined)
          const dbUser = await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
            select: {
              organizationId: true,
              role: true,
              email: true,
              teamId: true,
            },
          });

          let organizationId = dbUser?.organizationId ?? null;
          let role = dbUser?.role ?? "MEMBER";
          const teamId = dbUser?.teamId ?? null;

          // If there is no organization, check for a pending invitation and auto-accept it
          if (!organizationId && dbUser?.email) {
            const pendingInvitation = await prisma.invitation.findFirst({
              where: {
                email: dbUser.email,
                status: "PENDING",
                expiresAt: { gt: new Date() },
              },
              orderBy: { createdAt: "desc" },
            });

            if (pendingInvitation) {
              // Accept the invitation
              await prisma.$transaction([
                prisma.invitation.update({
                  where: { id: pendingInvitation.id },
                  data: { status: "ACCEPTED" },
                }),
                prisma.user.update({
                  where: { id: user.id },
                  data: {
                    organizationId: pendingInvitation.organizationId,
                    role: pendingInvitation.role,
                    teamId: pendingInvitation.teamId,
                  },
                }),
              ]);

              organizationId = pendingInvitation.organizationId;
              role = pendingInvitation.role;

              // Auto-accepted invitation log removed
            }
          }

          token.organizationId = organizationId;
          token.role = role;
          token.teamId = teamId;

          // On admin sign-in, auto-create build 1.0.0 if none exists
          if (organizationId && role === "ADMIN") {
            prisma.extensionBuild
              .count({ where: { organizationId } })
              .then((count) => {
                if (count === 0) {
                  triggerInitialBuild(organizationId).catch(console.error);
                }
              })
              .catch(console.error);
          }
        } catch (error) {
          // Prisma is unavailable on the Edge Runtime - use defaults
          // or the user may not be in the DB yet (new sign-up)
          console.error("[JWT Callback] Error:", error);
          token.organizationId = null;
          token.role = "MEMBER";
          token.teamId = null;
        }
      }

      // On a session update trigger or with an existing token (sync with the DB in the server environment)
      // Query the DB every time so organizationId changes are reflected in the session
      // Look up by email (token.id may not match the DB user.id)
      if ((trigger === "update" || token.id) && !user && token.email) {
        try {
          const dbUser = await loadTokenUser(token.email as string);
          if (dbUser) {
            token.id = dbUser.id; // Sync to the actual DB user.id

            let organizationId = dbUser.organizationId;
            let role = dbUser.role;
            const teamId = dbUser.teamId;

            // If there is no organization, check for a pending invitation and auto-accept it
            if (!organizationId) {
              const pendingInvitation = await prisma.invitation.findFirst({
                where: {
                  email: token.email as string,
                  status: "PENDING",
                  expiresAt: { gt: new Date() },
                },
                orderBy: { createdAt: "desc" },
              });

              if (pendingInvitation) {
                await prisma.$transaction([
                  prisma.invitation.update({
                    where: { id: pendingInvitation.id },
                    data: { status: "ACCEPTED" },
                  }),
                  prisma.user.update({
                    where: { id: dbUser.id },
                    data: {
                      organizationId: pendingInvitation.organizationId,
                      role: pendingInvitation.role,
                      teamId: pendingInvitation.teamId,
                    },
                  }),
                ]);

                organizationId = pendingInvitation.organizationId;
                role = pendingInvitation.role;

                // Auto-accepted invitation log removed
              }
            }

            token.organizationId = organizationId;
            token.role = role;
            token.teamId = teamId;
          }
        } catch {
          // Ignore on the Edge Runtime (keep existing token values)
        }
      }

      return token;
    },
    /**
     * Session callback: passes info from the JWT to the session
     */
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.organizationId = token.organizationId as string | null;
      session.user.role = (token.role || "MEMBER") as UserRole;
      session.user.teamId = (token.teamId as string | null) ?? null;
      return session;
    },
    /**
     * authorized callback: checks authentication in the middleware
     */
    authorized({ auth, request }) {
      const publicRoutes = ["/login", "/api/auth"];
      const { pathname } = request.nextUrl;

      // Auth Authorized log removed

      // Public routes are always allowed
      if (publicRoutes.some((route) => pathname.startsWith(route))) {
        return true;
      }

      // Unauthenticated users go to the login page (returning false redirects to the signIn page)
      if (!auth) {
        // console.log("[Auth Authorized] No auth, redirecting to login");
        return false;
      }

      // Allow the onboarding page
      if (pathname === "/onboarding") {
        return true;
      }

      // Allow the invitation acceptance page (accessible without organizationId)
      if (pathname.startsWith("/invite/")) {
        return true;
      }

      // SUPER_ADMIN may access /super-admin without an organizationId
      if ((auth.user?.role as string) === "SUPER_ADMIN") {
        if (pathname.startsWith("/super-admin")) return true;
        return Response.redirect(new URL("/super-admin", request.url));
      }

      // No organization: go to onboarding
      if (!auth.user?.organizationId) {
        // console.log("[Auth Authorized] No org, redirecting to onboarding");
        return Response.redirect(new URL("/onboarding", request.url));
      }

      return true;
    },
    /**
     * Redirect callback: resolves the post-login redirect URL
     */
    async redirect({ url, baseUrl }) {
      // Combine relative paths with baseUrl
      if (url.startsWith("/")) {
        // Root path or default redirect: go to the dashboard
        if (url === "/" || url === baseUrl || url === `${baseUrl}/`) {
          return `${baseUrl}/dashboard`;
        }
        return `${baseUrl}${url}`;
      }
      // Same origin: use as is
      try {
        const urlObj = new URL(url);
        if (urlObj.origin === baseUrl) {
          // Root path: go to the dashboard
          if (urlObj.pathname === "/" || urlObj.pathname === "") {
            return `${baseUrl}/dashboard`;
          }
          return url;
        }
      } catch {
        // URL parsing failed: go to the dashboard
        return `${baseUrl}/dashboard`;
      }
      // Default is also the dashboard
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login", // Errors also go to the login page
  },
  secret: process.env.AUTH_SECRET || "dev-secret-123",
});
