// src/lib/filters/report-filter-params.test.ts
import { describe, expect, it } from "vitest";

import {
  resolveReportFilterParams,
  writeReportFilterParams,
} from "./report-filter-params";

const admin = { id: "admin", role: "ADMIN", teamId: null, canReadAll: true };

describe("resolveReportFilterParams", () => {
  it("reads comma-separated teams and users for admins", () => {
    expect(
      resolveReportFilterParams({ teamId: "t1,t2", userId: "u1" }, admin)
    ).toEqual({ teamIds: ["t1", "t2"], userIds: ["u1"] });
  });

  it("accepts the legacy single value and repeated params", () => {
    expect(
      resolveReportFilterParams({ teamId: "t1", userId: ["u1", "u2"] }, admin)
    ).toEqual({ teamIds: ["t1"], userIds: ["u1", "u2"] });
  });

  it("returns empty lists when nothing is selected (= all)", () => {
    expect(resolveReportFilterParams({}, admin)).toEqual({
      teamIds: [],
      userIds: [],
    });
  });

  it("pins restricted members to their team and keeps their user picks", () => {
    expect(
      resolveReportFilterParams(
        { teamId: "other,t9", userId: "u1" },
        { id: "m1", role: "MEMBER", teamId: "t9" }
      )
    ).toEqual({ teamIds: ["t9"], userIds: ["u1"] });
  });

  it("pins restricted members without a team to themselves", () => {
    expect(
      resolveReportFilterParams(
        { teamId: "t1", userId: "u1,u2" },
        { id: "m1", role: "VIEWER", teamId: null }
      )
    ).toEqual({ teamIds: [], userIds: ["m1"] });
  });
});

describe("writeReportFilterParams", () => {
  it("sets comma-separated lists and removes empty ones", () => {
    const params = writeReportFilterParams(
      new URLSearchParams("period=30d&userId=old"),
      { teamIds: ["t1", "t2"], userIds: [] }
    );
    expect(params.get("teamId")).toBe("t1,t2");
    expect(params.has("userId")).toBe(false);
    expect(params.get("period")).toBe("30d");
  });
});
