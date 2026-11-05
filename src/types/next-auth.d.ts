// src/types/next-auth.d.ts
// NextAuth.js v5 session type augmentation

import { UserRole } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * User information included in the session
   * organizationId: the user's organization (onboarding required if missing)
   * role: user role (ADMIN/MEMBER/VIEWER)
   */
  interface Session {
    user: {
      id: string;
      organizationId?: string | null;
      role: UserRole;
      teamId?: string | null;
      department?: string | null;
      jobTitle?: string | null;
      phone?: string | null;
      avatarUrl?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/adapters" {
  /**
   * User type augmentation used by the Prisma Adapter
   */
  interface AdapterUser {
    organizationId?: string | null;
    role: UserRole;
  }
}

declare module "@auth/core/jwt" {
  /**
   * Data stored in the JWT
   * (used by the Edge Runtime middleware)
   */
  interface JWT {
    id: string;
    organizationId?: string | null;
    role: string;
    teamId?: string | null;
  }
}
