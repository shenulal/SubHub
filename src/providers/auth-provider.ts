import { AuthProvider } from "@refinedev/core";

// Browser-side NextAuth helpers. Importing from "@/lib/auth" here would pull the
// whole server auth configuration (Prisma, secrets) into the client bundle.
import { signIn, signOut } from "next-auth/react";

interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  organizationId?: string | null;
}

interface SessionResponse {
  user?: SessionUser;
  expires?: string;
}

const fetchSession = async (): Promise<SessionResponse | null> => {
  try {
    const res = await fetch("/api/auth/session", {
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as SessionResponse;
  } catch {
    return null;
  }
};

/**
 * Refine AuthProvider skeleton.
 * - Checks authentication state using the NextAuth v5 session.
 * - Full login/logout logic will follow the existing NextAuth flow in a later iteration.
 */
export const authProvider: AuthProvider = {
  login: async ({ providerName, email, username, password }) => {
    // User name or email + password through the NextAuth `password` provider.
    const result = await signIn(providerName ?? "password", {
      identifier: username ?? email,
      password,
      redirect: false,
    });
    if (result && (result.error || result.ok === false)) {
      return {
        success: false,
        error: {
          name: "SignInError",
          message: result.code ?? result.error ?? "invalid_credentials",
        },
      };
    }
    return {
      success: true,
      redirectTo: "/",
    };
  },
  logout: async () => {
    await signOut();
    return {
      success: true,
      redirectTo: "/login",
    };
  },
  check: async () => {
    const session = await fetchSession();
    if (session?.user) {
      return {
        authenticated: true,
      };
    }

    return {
      authenticated: false,
      redirectTo: "/login",
    };
  },
  getPermissions: async () => {
    const session = await fetchSession();
    return session?.user?.role ?? null;
  },
  getIdentity: async () => {
    const session = await fetchSession();
    if (!session?.user) return null;

    const { id, email, name, role, organizationId } = session.user;
    return { id, email, name, role, organizationId };
  },
  onError: async () => ({
    logout: true,
    redirectTo: "/login",
  }),
};
