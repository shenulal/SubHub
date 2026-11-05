// src/app/api/auth/refresh-session/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

/**
 * Session refresh API
 * Loads the latest user data from the DB and regenerates the JWT.
 * Mainly used to reflect organizationId in the session after accepting an invitation.
 */

import { withLogging } from "@/lib/logging";

/**
 * Session refresh API
 * Loads the latest user data from the DB and regenerates the JWT.
 * Mainly used to reflect organizationId in the session after accepting an invitation.
 */
export const GET = withLogging(
  "auth:refresh-session",
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, organizationId: true, role: true },
    });

    if (dbUser) {
      const secret = process.env.AUTH_SECRET || "dev-secret-123";

      const token = await encode({
        token: {
          id: dbUser.id,
          email: session.user.email,
          name: session.user.name,
          picture: session.user.image,
          organizationId: dbUser.organizationId,
          role: dbUser.role,
          sub: dbUser.id,
        },
        secret,
        salt: COOKIE_NAME,
      });

      const cookieStore = await cookies();
      cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }

    return NextResponse.redirect(new URL(callbackUrl, request.url));
  }
);
