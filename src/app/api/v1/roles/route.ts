// src/app/api/v1/roles/route.ts
import { permissionGroups, queryRoles } from "@/actions/platform/roles-query";
import { withApiAuth } from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import { NextResponse } from "next/server";

/** GET /api/v1/roles — system + custom roles with grants and member counts. */
export const GET = withLogging(
  "GET /api/v1/roles",
  withApiAuth(
    async (_request, { session }) => {
      const roles = await queryRoles(session.user.organizationId);
      return NextResponse.json({
        success: true,
        data: { roles, permissionGroups: permissionGroups() },
        meta: { total: roles.length },
      });
    },
    { permission: "members:read" }
  )
);
