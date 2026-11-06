// src/actions/cost-analytics-scope.test.ts
import { describe, expect, it } from "vitest";
import {
  applyCardTransactionScope,
  applyPaymentRecordScope,
  resolveReportScope,
} from "./cost-analytics-scope";

describe("cost-analytics-scope", () => {
  describe("resolveReportScope", () => {
    it("should return filter values for ADMIN users", () => {
      const result = resolveReportScope(
        { teamId: "team-1", userId: "user-1" },
        { id: "admin-1", role: "ADMIN", teamId: "admin-team", canReadAll: true }
      );
      expect(result).toEqual({ teamIds: ["team-1"], userIds: ["user-1"] });
    });

    it("should merge legacy single values with multi-value lists for ADMIN", () => {
      const result = resolveReportScope(
        { teamId: "team-1", teamIds: ["team-2", "team-1"], userIds: [] },
        { id: "admin-1", role: "ADMIN", teamId: null, canReadAll: true }
      );
      expect(result).toEqual({
        teamIds: ["team-2", "team-1"],
        userIds: undefined,
      });
    });

    it("should restrict to own user for MEMBER without team", () => {
      const result = resolveReportScope(
        { teamId: "team-1", userId: "user-1" },
        { id: "member-1", role: "MEMBER", teamId: null }
      );
      expect(result).toEqual({
        userIds: ["member-1"],
        enforceTeamId: undefined,
      });
    });

    it("should restrict to member team for MEMBER with team", () => {
      const result = resolveReportScope(
        { teamId: "other-team", userId: "user-1" },
        { id: "member-1", role: "MEMBER", teamId: "member-team" }
      );
      expect(result).toEqual({
        teamIds: ["member-team"],
        userIds: ["user-1"],
        enforceTeamId: "member-team",
      });
    });

    it("should treat VIEWER as restricted", () => {
      const result = resolveReportScope(
        { teamId: "team-1" },
        { id: "viewer-1", role: "VIEWER", teamId: "viewer-team" }
      );
      expect(result.teamIds).toEqual(["viewer-team"]);
      expect(result.enforceTeamId).toBe("viewer-team");
    });
  });

  describe("applyPaymentRecordScope", () => {
    it("should set userId when scope has userId", () => {
      const where: Record<string, unknown> = {};
      applyPaymentRecordScope(where, { userId: "user-1" });
      expect(where.userId).toBe("user-1");
    });

    it("should set user.teamId when enforceTeamId is set", () => {
      const where: Record<string, unknown> = {};
      applyPaymentRecordScope(where, {
        userId: "user-1",
        enforceTeamId: "team-1",
      });
      expect(where.userId).toBe("user-1");
      expect(where.user).toEqual({ teamId: "team-1" });
    });

    it("should set OR condition for teamId scope", () => {
      const where: Record<string, unknown> = {};
      applyPaymentRecordScope(where, { teamId: "team-1" });
      expect(where.OR).toEqual([
        { teamId: "team-1" },
        { user: { teamId: "team-1" } },
      ]);
    });

    it("should not modify where when scope is empty", () => {
      const where: Record<string, unknown> = {};
      applyPaymentRecordScope(where, {});
      expect(Object.keys(where)).toHaveLength(0);
    });

    it("should use `in` for several users or teams", () => {
      const byUsers: Record<string, unknown> = {};
      applyPaymentRecordScope(byUsers, { userIds: ["u1", "u2"] });
      expect(byUsers.userId).toEqual({ in: ["u1", "u2"] });

      const byTeams: Record<string, unknown> = {};
      applyPaymentRecordScope(byTeams, { teamIds: ["t1", "t2"], userIds: [] });
      expect(byTeams.OR).toEqual([
        { teamId: { in: ["t1", "t2"] } },
        { user: { teamId: { in: ["t1", "t2"] } } },
      ]);
    });
  });

  describe("applyCardTransactionScope", () => {
    it("should set corporateCard.assignedUserId for userId scope", () => {
      const where: Record<string, unknown> = {};
      applyCardTransactionScope(where, { userId: "user-1" });
      expect(where.corporateCard).toEqual({ assignedUserId: "user-1" });
    });

    it("should add team enforcement for userId with enforceTeamId", () => {
      const where: Record<string, unknown> = {};
      applyCardTransactionScope(where, {
        userId: "user-1",
        enforceTeamId: "team-1",
      });
      expect(where.corporateCard).toEqual({
        assignedUserId: "user-1",
        assignedUser: { teamId: "team-1" },
      });
    });

    it("should set OR condition for teamId scope", () => {
      const where: Record<string, unknown> = {};
      applyCardTransactionScope(where, { teamId: "team-1" });
      expect(where.corporateCard).toEqual({
        OR: [{ teamId: "team-1" }, { assignedUser: { teamId: "team-1" } }],
      });
    });

    it("should not modify where when scope is empty", () => {
      const where: Record<string, unknown> = {};
      applyCardTransactionScope(where, {});
      expect(Object.keys(where)).toHaveLength(0);
    });

    it("should use `in` for several users or teams", () => {
      const byUsers: Record<string, unknown> = {};
      applyCardTransactionScope(byUsers, { userIds: ["u1", "u2"] });
      expect(byUsers.corporateCard).toEqual({
        assignedUserId: { in: ["u1", "u2"] },
      });

      const byTeams: Record<string, unknown> = {};
      applyCardTransactionScope(byTeams, { teamIds: ["t1", "t2"] });
      expect(byTeams.corporateCard).toEqual({
        OR: [
          { teamId: { in: ["t1", "t2"] } },
          { assignedUser: { teamId: { in: ["t1", "t2"] } } },
        ],
      });
    });
  });
});
