// src/lib/auth/index.ts
// NextAuth.js v5 configuration (App Router) - JWT strategy

import { triggerInitialBuild } from "@/actions/extensions/builds";
import { prisma } from "@/lib/db";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import { cache } from "react";
import { authorizeEmailCode, authorizePassword } from "./authorize";
import { EMAIL_CODE_PROVIDER_ID, PASSWORD_PROVIDER_ID } from "./sign-in-codes";

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
    select: {
      id: true,
      organizationId: true,
      role: true,
      teamId: true,
      mustChangePassword: true,
      organization: { select: { deactivatedAt: true } },
    },
  })
);

/**
 * A deactivated tenant (SaaS) keeps its data, but its members' sessions carry no
 * organisation until it is reactivated — every org-scoped page and action then
 * redirects to onboarding, which explains the situation.
 */
function activeOrganizationId(user: {
  organizationId: string | null;
  organization?: { deactivatedAt: Date | null } | null;
}): string | null {
  if (!user.organizationId) return null;
  return user.organization?.deactivatedAt ? null : user.organizationId;
}

/**
 * JWT signing secret. Production requires AUTH_SECRET (or NEXTAUTH_SECRET) and
 * never falls back to a built-in value; development keeps the local fallback.
 */
function resolveAuthSecret(): string {
  // `next build` evaluates modules without runtime secrets; the server re-reads
  // the environment when it starts.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "build-phase-placeholder";
  }
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error(
        "AUTH_SECRET (or NEXTAUTH_SECRET) must be set in production. Generate one with: openssl rand -base64 32"
      );
    }
    return secret;
  }
  return process.env.AUTH_SECRET || "dev-secret-123";
}

/**
 * NextAuth.js v5 configuration
 * - Credentials provider `password` (user name or email + password, optional
 *   emailed code as a second step)
 * - Credentials provider `credentials` (passwordless email code, setting-gated)
 * - Apple OAuth when APPLE_CLIENT_ID / APPLE_CLIENT_SECRET are set
 * - Prisma adapter (DB integration)
 * - JWT session strategy (Edge Runtime support)
 * - Adds organizationId and role to the session
 */

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true, // Required when running behind a proxy such as Vercel
  providers: [
    Credentials({
      id: PASSWORD_PROVIDER_ID,
      name: "Password",
      credentials: {
        identifier: { label: "Email or user name", type: "text" },
        password: { label: "Password", type: "password" },
        otp: { label: "Verification code", type: "text" },
        audience: { label: "Audience", type: "text" },
      },
      authorize: (credentials) =>
        authorizePassword(credentials, {
          ssoAvailable: isAppleSignInEnabled(),
        }),
    }),
    // Passwordless "email me a code" sign-in; refused unless the
    // organisation enables security.allowEmailCodeSignIn.
    Credentials({
      id: EMAIL_CODE_PROVIDER_ID,
      name: "Email code",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "Verification code", type: "text" },
      },
      authorize: (credentials) => authorizeEmailCode(credentials),
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
              mustChangePassword: true,
              organization: { select: { deactivatedAt: true } },
            },
          });

          let organizationId = dbUser ? activeOrganizationId(dbUser) : null;
          let role = dbUser?.role ?? "MEMBER";
          const teamId = dbUser?.teamId ?? null;

          // If there is no organization, check for a pending invitation and auto-accept it
          // (never for platform administrators, who have no organisation by design)
          if (
            !dbUser?.organizationId &&
            dbUser?.email &&
            dbUser.role !== "SUPER_ADMIN"
          ) {
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
          token.mustChangePassword = dbUser?.mustChangePassword ?? false;

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
          token.mustChangePassword = false;
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

            let organizationId = activeOrganizationId(dbUser);
            let role = dbUser.role;
            const teamId = dbUser.teamId;

            // If there is no organization, check for a pending invitation and auto-accept it
            if (!dbUser.organizationId && dbUser.role !== "SUPER_ADMIN") {
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
            token.mustChangePassword = dbUser.mustChangePassword;
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
      session.user.mustChangePassword = Boolean(token.mustChangePassword);
      return session;
    },
    /**
     * authorized callback: checks authentication in the middleware
     */
    authorized({ auth, request }) {
      const publicRoutes = [
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/api/auth",
      ];
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
  secret: resolveAuthSecret(),
});
