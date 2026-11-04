// src/actions/approvals/team-approver.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTeamApproverOptions, setTeamApprover } from "./team-approver";

const prisma = vi.hoisted(() => ({
  team: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  user: { findMany: vi.fn(), findFirst: vi.fn() },
  auditLog: { create: vi.fn() },
}));
const requirePermission = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission,
  isForbiddenError: (e: unknown) => (e as Error)?.name === "ForbiddenError",
}));

beforeEach(() => {
  vi.resetAllMocks();
  requirePermission.mockResolvedValue({
    organizationId: "org",
    userId: "admin",
    role: "ADMIN",
    permissions: new Set(),
  });
});

describe("team approver actions", () => {
  it("lists teams with their approver and member count", async () => {
    prisma.team.findMany.mockResolvedValue([
      {
        id: "t1",
        name: "Design",
        approver: { id: "u1", name: "A", email: "a@x", image: null },
        _count: { members: 4 },
      },
    ]);
    prisma.user.findMany.mockResolvedValue([]);
    const res = await getTeamApproverOptions();
    expect(res.data?.teams).toEqual([
      {
        id: "t1",
        name: "Design",
        approver: { id: "u1", name: "A", email: "a@x", image: null },
        memberCount: 4,
      },
    ]);
  });

  it("sets and clears the approver with validation and audit", async () => {
    prisma.team.findFirst.mockResolvedValue({ id: "t1", approverId: null });
    prisma.user.findFirst.mockResolvedValue({ id: "u1" });
    const res = await setTeamApprover("t1", "u1");
    expect(requirePermission).toHaveBeenCalledWith("approval_policies:manage");
    expect(res.success).toBe(true);
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { approverId: "u1" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "UPDATE_TEAM_APPROVER",
          changes: { from: null, to: "u1" },
        }),
      })
    );
    await setTeamApprover("t1", null);
    expect(prisma.team.update).toHaveBeenLastCalledWith({
      where: { id: "t1" },
      data: { approverId: null },
    });
  });

  it("rejects unknown teams or users", async () => {
    prisma.team.findFirst.mockResolvedValue(null);
    expect((await setTeamApprover("nope", "u1")).error).toBe("Team not found");
    prisma.team.findFirst.mockResolvedValue({ id: "t1", approverId: null });
    prisma.user.findFirst.mockResolvedValue(null);
    expect((await setTeamApprover("t1", "ghost")).error).toBe("User not found");
  });
});
