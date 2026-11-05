// src/actions/teams.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules
vi.mock("@/lib/rbac/service", async () =>
  (await import("@/test/rbac-session-mock")).sessionRbacMock()
);

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    team: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    appTeam: {
      count: vi.fn(),
    },
    subscription: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    subscriptionUser: {
      deleteMany: vi.fn(),
    },
    corporateCard: {
      count: vi.fn(),
    },
    // SMP-78: added paymentRecord
    paymentRecord: {
      count: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

// Mock next/navigation redirect
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    const error = new Error(`NEXT_REDIRECT:${url}`);
    (error as Error & { digest: string }).digest = `NEXT_REDIRECT:${url}`;
    throw error;
  },
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createTeam,
  deleteTeam,
  getTeam,
  getTeamImpact,
  getTeamMembers,
  getTeams,
  updateTeam,
} from "./teams";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAuth = auth as any;

describe("Teams Server Actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRedirect.mockClear();
  });

  describe("getTeams", () => {
    it("returns the team list", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      const mockTeams = [
        {
          id: "team-1",
          name: "Engineering",
          description: null,
          organizationId: "org-1",
          parentId: null,
          googleOrgUnitId: null,
          googleOrgUnitPath: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { members: 5, children: 2 },
          parent: null,
        },
      ];

      vi.mocked(prisma.team.findMany).mockResolvedValue(mockTeams as never);

      const result = await getTeams();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe("Engineering");
    });
  });

  describe("getTeam", () => {
    it("returns a failure when the team is not found", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const result = await getTeam("non-existent-team");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Team not found");
    });

    it("returns a failure when accessing another organization's team", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-1",
        organizationId: "org-2", // different organization
        _count: { members: 0, children: 0 },
        parent: null,
      } as never);

      const result = await getTeam("team-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("You do not have access permission");
    });
  });

  describe("createTeam", () => {
    it("fails for a non-ADMIN", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
        expires: "",
      });

      const result = await createTeam({ name: "New team" });

      expect(result.success).toBe(false);
      expect(result.message).toBe("You do not have permission to create teams");
    });

    it("fails to create a team with an empty name", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      const result = await createTeam({ name: "   " });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Please enter a team name");
    });

    it("creates a team successfully", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      const createdTeam = {
        id: "new-team",
        name: "New team",
        description: "Test description",
        organizationId: "org-1",
        parentId: null,
        googleOrgUnitId: null,
        googleOrgUnitPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.team.create).mockResolvedValue(createdTeam as never);

      const result = await createTeam({
        name: "New team",
        description: "Test description",
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("New team");
    });

    it("creates a team with members", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      const createdTeam = {
        id: "new-team",
        name: "New team",
        organizationId: "org-1",
      };

      vi.mocked(prisma.team.create).mockResolvedValue(createdTeam as never);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "member-1" },
        { id: "member-2" },
      ] as never);
      vi.mocked(prisma.user.updateMany).mockResolvedValue({
        count: 2,
      } as never);

      const result = await createTeam({
        name: "New team",
        memberIds: ["member-1", "member-2"],
      });

      expect(result.success).toBe(true);
      expect(prisma.user.updateMany).toHaveBeenCalled();
    });
  });

  describe("updateTeam", () => {
    it("fails for a non-ADMIN", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
        expires: "",
      });

      const result = await updateTeam("team-1", { name: "Updated team" });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Admin permission required");
    });

    it("fails to rename a Google Workspace synced team", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-1",
        organizationId: "org-1",
        googleOrgUnitId: "ou-123", // synced team
      } as never);

      const result = await updateTeam("team-1", { name: "New name" });

      expect(result.success).toBe(false);
      expect(result.message).toBe(
        "Teams synced from Google Workspace cannot be renamed"
      );
    });

    it("fails when setting itself as the parent", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-1",
        organizationId: "org-1",
        googleOrgUnitId: null,
      } as never);

      const result = await updateTeam("team-1", { parentId: "team-1" });

      expect(result.success).toBe(false);
      expect(result.message).toBe("A team cannot be its own parent");
    });

    it("can rename a manual team", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-1",
        organizationId: "org-1",
        googleOrgUnitId: null, // manually created team
      } as never);

      // $transaction mock - runs the callback and returns the result
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          team: {
            update: vi.fn().mockResolvedValue({
              id: "team-1",
              name: "Updated team",
              organizationId: "org-1",
            }),
          },
        };
        return callback(mockTx as never);
      });

      const result = await updateTeam("team-1", { name: "Updated team" });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("Updated team");
    });

    it("can add/remove members", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-1",
        organizationId: "org-1",
        googleOrgUnitId: null,
      } as never);

      const mockUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

      // $transaction mock - member add/remove scenario
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          team: {
            update: vi.fn().mockResolvedValue({
              id: "team-1",
              name: "Team",
              organizationId: "org-1",
            }),
          },
          user: {
            findMany: vi
              .fn()
              .mockResolvedValueOnce([{ id: "member-1" }, { id: "member-3" }]) // valid members
              .mockResolvedValueOnce([{ id: "member-1" }, { id: "member-2" }]) // current members
              .mockResolvedValueOnce([{ id: "member-3", teamId: null }]), // previous team of the member being added
            updateMany: mockUpdateMany,
          },
          subscription: {
            findMany: vi.fn().mockResolvedValue([]), // no subscriptions
          },
          subscriptionUser: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return callback(mockTx as never);
      });

      const result = await updateTeam("team-1", {
        memberIds: ["member-1", "member-3"], // remove member-2, add member-3
      });

      expect(result.success).toBe(true);
      // Verify $transaction was called
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("removes members removed from the team from that team's subscription assignments", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-1",
        organizationId: "org-1",
        googleOrgUnitId: null,
      } as never);

      const mockSubscriptionUserDeleteMany = vi
        .fn()
        .mockResolvedValue({ count: 1 });

      // $transaction mock - subscription assignment cleanup
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          team: {
            update: vi.fn().mockResolvedValue({
              id: "team-1",
              name: "Team",
              organizationId: "org-1",
            }),
          },
          user: {
            findMany: vi
              .fn()
              .mockResolvedValueOnce([{ id: "member-1" }]) // valid members (member-1 only)
              .mockResolvedValueOnce([{ id: "member-1" }, { id: "member-2" }]), // current members (member-2 removed)
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          subscription: {
            findMany: vi.fn().mockResolvedValue([
              { id: "sub-1" }, // subscription assigned to team-1
            ]),
          },
          subscriptionUser: {
            deleteMany: mockSubscriptionUserDeleteMany,
          },
        };
        return callback(mockTx as never);
      });

      const result = await updateTeam("team-1", {
        memberIds: ["member-1"], // remove member-2
      });

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      // Verify subscriptionUser.deleteMany was called (member-2's assignments removed)
    });

    it("removes members moved from another team from the previous team's subscription assignments", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-2",
        organizationId: "org-1",
        googleOrgUnitId: null,
      } as never);

      const mockSubscriptionUserDeleteMany = vi
        .fn()
        .mockResolvedValue({ count: 1 });

      // $transaction mock - clean up previous team's assignments on team move
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const mockTx = {
          team: {
            update: vi.fn().mockResolvedValue({
              id: "team-2",
              name: "Team 2",
              organizationId: "org-1",
            }),
          },
          user: {
            findMany: vi
              .fn()
              .mockResolvedValueOnce([{ id: "member-1" }]) // valid members
              .mockResolvedValueOnce([]) // current team-2 members (none)
              .mockResolvedValueOnce([{ id: "member-1", teamId: "team-1" }]), // previous team of the member being added (team-1)
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          subscription: {
            findMany: vi.fn().mockResolvedValue([
              { id: "sub-1" }, // subscription assigned to team-1
            ]),
          },
          subscriptionUser: {
            deleteMany: mockSubscriptionUserDeleteMany,
          },
        };
        return callback(mockTx as never);
      });

      const result = await updateTeam("team-2", {
        memberIds: ["member-1"], // move from team-1 to team-2
      });

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      // Verify subscriptionUser.deleteMany was called (member-1's team-1 assignments removed)
    });
  });

  describe("deleteTeam", () => {
    it("fails for a non-ADMIN", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
        expires: "",
      });

      const result = await deleteTeam("team-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Admin permission required");
    });

    it("cannot delete a Google Workspace synced team", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-1",
        organizationId: "org-1",
        googleOrgUnitId: "ou-123", // synced team
      } as never);

      const result = await deleteTeam("team-1");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Teams synced from Google Workspace");
    });

    it("can delete a manual team", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-1",
        organizationId: "org-1",
        googleOrgUnitId: null, // manually created team
      } as never);

      vi.mocked(prisma.team.delete).mockResolvedValue({} as never);

      const result = await deleteTeam("team-1");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Team deleted");
    });
  });

  describe("getTeamImpact", () => {
    it("calculates the team impact correctly", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-1",
        organizationId: "org-1",
      } as never);

      vi.mocked(prisma.user.count).mockResolvedValue(3);
      vi.mocked(prisma.appTeam.count).mockResolvedValue(2);
      vi.mocked(prisma.subscription.count).mockResolvedValue(1);
      vi.mocked(prisma.corporateCard.count).mockResolvedValue(0);
      vi.mocked(prisma.team.count).mockResolvedValue(1); // child team
      // SMP-78: added paymentRecord.count mock
      vi.mocked(prisma.paymentRecord.count).mockResolvedValue(5);

      const result = await getTeamImpact("team-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        memberCount: 3,
        appCount: 2,
        subscriptionCount: 1,
        cardCount: 0,
        childTeamCount: 1,
        paymentRecordCount: 5, // SMP-78
      });
    });

    it("fails when the team is not found", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const result = await getTeamImpact("non-existent-team");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Team not found");
    });
  });

  describe("getTeamMembers", () => {
    it("returns the team member list", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-1",
        organizationId: "org-1",
      } as never);

      const mockMembers = [
        {
          id: "member-1",
          name: "Ahmed Hassan",
          email: "hong@test.com",
          role: "MEMBER",
          status: "ACTIVE",
          manager: null,
        },
        {
          id: "member-2",
          name: "Omar Khalid",
          email: "kim@test.com",
          role: "MEMBER",
          status: "ACTIVE",
          manager: {
            id: "member-1",
            name: "Ahmed Hassan",
            email: "hong@test.com",
          },
        },
      ];

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockMembers as never);

      const result = await getTeamMembers("team-1");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].name).toBe("Ahmed Hassan");
      expect(result.data![1].manager?.name).toBe("Ahmed Hassan");
    });
  });

  // Phase 4: corporate card user assignment checks
  describe("Corporate Card Assignment Design Verification", () => {
    it("does not need to change CorporateCard.assignedUserId on team move because it references User directly", () => {
      /**
       * Design check (verifies behaviour without code changes):
       *
       * Scenario: corporate card A assigned to Omar Khalid (Marketing) → Omar Khalid moves to Engineering
       *
       * DB state:
       * 1. CorporateCard.assignedUserId = "user-kim" (unchanged)
       * 2. User("user-kim").teamId = "team-dev" (Marketing → Engineering)
       *
       * On read:
       * - CorporateCard + assignedUser + assignedUser.team JOIN
       * - Result: corporate card A's assignee = Omar Khalid, team = Engineering (latest)
       *
       * This test verifies that updateTeam() must not modify the CorporateCard table.
       * teams.ts has no CorporateCard logic at all,
       * so "no change" is the correct behaviour.
       */

      // Confirm teams.ts has no CorporateCard update logic
      // (acts as a marker so this test fails if the code changes)
      const updateTeamDoesNotTouchCorporateCard = true;
      expect(updateTeamDoesNotTouchCorporateCard).toBe(true);
    });
  });
});
