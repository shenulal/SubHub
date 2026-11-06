// src/actions/invitations.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import { sendInvitationEmail } from "@/lib/services/notification/email";
import type { ActionState } from "@/types";
import type { Invitation, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface CreateInvitationInput {
  email: string;
  role: UserRole;
  teamId?: string;
}

export interface InvitationWithInviter extends Invitation {
  invitedBy: {
    name: string | null;
  } | null;
}

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["ADMIN", "APPROVER", "MEMBER", "VIEWER"]),
  teamId: z.string().optional(),
});

// Create an invitation
async function _createInvitation(
  input: CreateInvitationInput | FormData
): Promise<ActionState> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    // Inviting needs `members:invite` (granted to administrators by default)
    if (!(await can("members:invite"))) {
      return {
        success: false,
        message: "You do not have permission to invite members",
      };
    }

    const parsed =
      input instanceof FormData
        ? inviteSchema.safeParse({
            email: input.get("email"),
            role: input.get("role"),
            teamId: input.get("teamId") || undefined,
          })
        : inviteSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        message: "Please check your input",
        errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { email, role, teamId } = parsed.data;

    // Check whether the user already belongs to the organization
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        organizationId: session.user.organizationId,
      },
    });

    if (existingUser) {
      return {
        success: false,
        message: "This user already belongs to the organization",
      };
    }

    // Check for a pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        organizationId: session.user.organizationId,
        status: "PENDING",
      },
    });

    if (existingInvitation) {
      return {
        success: false,
        message: "A pending invitation already exists",
      };
    }

    // Delete existing invitations (ACCEPTED/EXPIRED/CANCELLED - allow re-invites)
    await prisma.invitation.deleteMany({
      where: {
        email,
        organizationId: session.user.organizationId,
        status: { not: "PENDING" },
      },
    });

    // Validate the team (when a teamId is given)
    if (teamId) {
      const team = await prisma.team.findFirst({
        where: {
          id: teamId,
          organizationId: session.user.organizationId,
        },
      });

      if (!team) {
        return {
          success: false,
          message: "Invalid team",
        };
      }
    }

    // Set the expiry date (7 days later)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create the invitation
    const invitation = await prisma.invitation.create({
      data: {
        email,
        role,
        organizationId: session.user.organizationId,
        invitedById: session.user.id,
        teamId: teamId || null,
        status: "PENDING",
        expiresAt,
      },
      include: {
        organization: true,
        invitedBy: true,
      },
    });

    // Send the invitation email
    await sendInvitationEmail({
      email: invitation.email,
      token: invitation.token,
      organizationName: invitation.organization.name,
      inviterName: invitation.invitedBy?.name || "Administrator",
      role: invitation.role,
    });

    revalidatePath("/settings/team");

    return {
      success: true,
      message: "Invitation sent",
    };
  } catch (error) {
    logger.error({ err: error }, "Invitation creation error");
    return {
      success: false,
      message: "An error occurred while creating the invitation",
    };
  }
}
export const createInvitation = withLogging(
  "createInvitation",
  _createInvitation
);

// List invitations
export async function getInvitations(): Promise<
  ActionState<InvitationWithInviter[]>
> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }
    if (!(await can("members:read"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        invitedBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      data: invitations,
    };
  } catch (error) {
    logger.error({ err: error }, "Invitation list error");
    return {
      success: false,
      message: "An error occurred while loading invitations",
    };
  }
}

// Cancel an invitation
async function _cancelInvitation(
  input: string | FormData
): Promise<ActionState> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    // Check admin permission
    if (!(await can("members:invite"))) {
      return {
        success: false,
        message: "Only admins can cancel invitations",
      };
    }

    const invitationId =
      input instanceof FormData ? (input.get("invitationId") as string) : input;

    if (!invitationId) {
      return { success: false, message: "Invitation ID is required" };
    }

    // Look up the invitation
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId: session.user.organizationId,
      },
    });

    if (!invitation) {
      return {
        success: false,
        message: "Invitation not found",
      };
    }

    // Cancel the invitation
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "CANCELLED" },
    });

    revalidatePath("/settings/team");

    return {
      success: true,
      message: "Invitation cancelled",
    };
  } catch (error) {
    logger.error({ err: error }, "Invitation cancellation error");
    return {
      success: false,
      message: "An error occurred while cancelling the invitation",
    };
  }
}
export const cancelInvitation = withLogging(
  "cancelInvitation",
  _cancelInvitation
);

// Resend an invitation
async function _resendInvitation(
  input: string | FormData
): Promise<ActionState> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    // Check admin permission
    if (!(await can("members:invite"))) {
      return {
        success: false,
        message: "Only admins can resend invitations",
      };
    }

    const invitationId =
      input instanceof FormData ? (input.get("invitationId") as string) : input;

    if (!invitationId) {
      return { success: false, message: "Invitation ID is required" };
    }

    // Look up the invitation
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId: session.user.organizationId,
      },
      include: {
        organization: true,
        invitedBy: true,
      },
    });

    if (!invitation) {
      return {
        success: false,
        message: "Invitation not found",
      };
    }

    if (invitation.status !== "PENDING") {
      return {
        success: false,
        message: "Only pending invitations can be resent",
      };
    }

    // Create a new token and expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const newToken = crypto.randomUUID();

    // Update the invitation
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        expiresAt,
        token: newToken,
        updatedAt: new Date(),
      },
      include: {
        organization: true,
        invitedBy: true,
      },
    });

    // Resend the invitation email
    await sendInvitationEmail({
      email: updatedInvitation.email,
      token: updatedInvitation.token,
      organizationName: updatedInvitation.organization.name,
      inviterName: updatedInvitation.invitedBy?.name || "Administrator",
      role: updatedInvitation.role,
    });

    revalidatePath("/settings/team");

    return {
      success: true,
      message: "Invitation resent",
    };
  } catch (error) {
    logger.error({ err: error }, "Invitation resend error");
    return {
      success: false,
      message: "An error occurred while resending the invitation",
    };
  }
}
export const resendInvitation = withLogging(
  "resendInvitation",
  _resendInvitation
);

// Accept an invitation
async function _acceptInvitation(token: string): Promise<ActionState> {
  try {
    // Look up the invitation
    const invitation = await prisma.invitation.findFirst({
      where: {
        token,
        status: "PENDING",
      },
    });

    if (!invitation) {
      return {
        success: false,
        message: "Invalid invitation",
      };
    }

    // Check expiry
    if (new Date() > invitation.expiresAt) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });

      return {
        success: false,
        message: "The invitation has expired",
      };
    }

    // Check the currently signed-in user
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Please sign in first",
        error: "SIGN_IN_REQUIRED",
      };
    }

    // Check that the email matches
    if (session.user.email !== invitation.email) {
      return {
        success: false,
        message: "Please sign in with the invited email address",
      };
    }

    // Check whether the user already belongs to another organization
    if (session.user.organizationId) {
      return {
        success: false,
        message: "You already belong to another organization",
      };
    }

    // Accept the invitation
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", token: crypto.randomUUID() },
    });

    // Link the user to the organization (upsert: create if missing, otherwise update)
    await prisma.user.upsert({
      where: { email: session.user.email! },
      update: {
        organizationId: invitation.organizationId,
        role: invitation.role,
        teamId: invitation.teamId,
      },
      create: {
        email: session.user.email!,
        name: session.user.name,
        image: session.user.image,
        organizationId: invitation.organizationId,
        role: invitation.role,
        teamId: invitation.teamId,
      },
    });

    return {
      success: true,
      message: "The invitation has been accepted",
    };
  } catch (error) {
    logger.error({ err: error }, "Invitation acceptance error");
    return {
      success: false,
      message: "An error occurred while accepting the invitation",
    };
  }
}
export const acceptInvitation = withLogging(
  "acceptInvitation",
  _acceptInvitation
);
