// middleware.ts
// Auth middleware - only allows public routes here; everything else is handled in Server Components/Actions
// Note: the auth() wrapper validates the session on every request → risk of exhausting the DB connection pool

import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { defaultLocale, locales } from "@/i18n/config";

const intlMiddleware = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: "never",
});

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect /extensions → /extensions/usage (before the page loads)
  if (pathname === "/extensions") {
    return NextResponse.redirect(new URL("/extensions/usage", request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
