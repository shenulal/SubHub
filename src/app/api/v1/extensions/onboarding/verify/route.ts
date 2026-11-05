// src/app/api/v1/extensions/onboarding/verify/route.ts
/**
 * Extension onboarding email verification API
 * Checks whether the email belongs to a user in the organization
 */

import { withExtensionAuth } from "@/lib/api/extension-auth";
import { prisma } from "@/lib/db";
import { onboardingVerifySchema } from "@/types/extension-api";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/extensions/onboarding/verify
 * Email verification: check the User table or Invitation + domain matching
 */
export const POST = withExtensionAuth(
  async (request: NextRequest, { auth }) => {
    try {
      const body = await request.json();
      const parseResult = onboardingVerifySchema.safeParse(body);

      if (!parseResult.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              parseResult.error.issues[0]?.message || "Invalid request body",
          },
          { status: 400 }
        );
      }

      const { email } = parseResult.data;

      // Extract the email domain
      const emailDomain = email.split("@")[1]?.toLowerCase();
      if (!emailDomain) {
        // Do not expose the specific failure reason (prevents email enumeration)
        return NextResponse.json({
          success: true,
          data: { verified: false },
        });
      }

      // Check organization domains
      const org = await prisma.organization.findUnique({
        where: { id: auth.organizationId },
        select: { domain: true, googlePrimaryDomain: true, settings: true },
      });

      if (!org) {
        return NextResponse.json({
          success: true,
          data: { verified: false },
        });
      }

      // Domain matching (organization.domain, googlePrimaryDomain or settings.domains)
      const orgDomain = org.domain?.toLowerCase();
      const googleDomain = org.googlePrimaryDomain?.toLowerCase();
      const settings = (org.settings as Record<string, unknown>) || {};
      const additionalDomains = ((settings.domains as string[]) || []).map(
        (d) => d.toLowerCase()
      );
      const domainMatches =
        emailDomain === orgDomain ||
        emailDomain === googleDomain ||
        additionalDomains.includes(emailDomain);

      if (!domainMatches) {
        return NextResponse.json({
          success: true,
          data: { verified: false },
        });
      }

      // Look up the user (within the organization)
      const user = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          organizationId: auth.organizationId,
        },
        select: { id: true, name: true },
      });

      if (user) {
        return NextResponse.json({
          success: true,
          data: {
            verified: true,
            userId: user.id,
            userName: user.name,
          },
        });
      }

      // Check invitations (PENDING status)
      const invitation = await prisma.invitation.findFirst({
        where: {
          email: email.toLowerCase(),
          organizationId: auth.organizationId,
          status: "PENDING",
        },
        select: { id: true },
      });

      if (invitation) {
        return NextResponse.json({
          success: true,
          data: {
            verified: true,
            // Invited users may not have a User record yet
          },
        });
      }

      // Verification failed (specific reason not exposed)
      return NextResponse.json({
        success: true,
        data: { verified: false },
      });
    } catch (error) {
      console.error("Onboarding verify error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to verify email" },
        { status: 500 }
      );
    }
  }
);
