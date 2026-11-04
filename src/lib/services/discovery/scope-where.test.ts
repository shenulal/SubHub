// src/lib/services/discovery/scope-where.test.ts
import { describe, expect, it } from "vitest";

import { readScopeCookie, SCOPE_COOKIE } from "./scope-cookie";
import { discoveryWhere, scopeWhere, visibilityWhere } from "./scope-where";

describe("scope-where", () => {
  it("builds scope fragments", () => {
    expect(scopeWhere("personal", "u1")).toEqual({
      isPersonal: true,
      ownerId: "u1",
    });
    expect(scopeWhere("workspace", "u1")).toEqual({ isPersonal: false });
    expect(scopeWhere("all", "u1")).toEqual({});
  });

  it("restricts visibility to own/team/assigned unless read_all", () => {
    expect(
      visibilityWhere({ userId: "u1", teamId: null, canReadAll: true })
    ).toEqual({});
    expect(
      visibilityWhere({ userId: "u1", teamId: "t1", canReadAll: false })
    ).toEqual({
      OR: [
        { ownerId: "u1" },
        { assignedUsers: { some: { userId: "u1" } } },
        { teamId: "t1" },
      ],
    });
  });

  it("always pins the organisation", () => {
    const where = discoveryWhere(
      "org",
      "all",
      { userId: "u1", teamId: null, canReadAll: true },
      { status: "ACTIVE" }
    );
    expect(where.AND).toEqual([
      { organizationId: "org" },
      {},
      {},
      { status: "ACTIVE" },
    ]);
  });
});

describe("scope-cookie", () => {
  it("reads a valid scope and ignores junk", () => {
    expect(readScopeCookie(`foo=1; ${SCOPE_COOKIE}=personal; bar=2`)).toBe(
      "personal"
    );
    expect(readScopeCookie(`${SCOPE_COOKIE}=galaxy`)).toBeNull();
    expect(readScopeCookie("")).toBeNull();
  });
});
