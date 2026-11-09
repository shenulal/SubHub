import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermission = vi.fn();
const getApps = vi.fn();
const getSetting = vi.fn();

vi.mock("@/lib/rbac/service", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
  isForbiddenError: (error: unknown) =>
    error instanceof Error && error.name === "ForbiddenError",
}));
vi.mock("@/actions/apps", () => ({
  getApps: (...args: unknown[]) => getApps(...args),
}));
vi.mock("@/lib/settings/service", () => ({
  getSetting: (...args: unknown[]) => getSetting(...args),
}));

import { listAppsForMasters } from "./apps-master-list";

class ForbiddenError extends Error {
  readonly name = "ForbiddenError";
}

beforeEach(() => {
  requirePermission.mockResolvedValue({ organizationId: "org-1" });
  getSetting.mockResolvedValue(25);
  getApps.mockResolvedValue({ items: [{ id: "a" }], total: 1 });
});

describe("listAppsForMasters", () => {
  it("requires apps:read and pages with the organisation's list size", async () => {
    const result = await listAppsForMasters({
      query: " sla ",
      status: "ACTIVE",
      page: 2,
    });
    expect(requirePermission).toHaveBeenCalledWith("apps:read");
    expect(getSetting).toHaveBeenCalledWith("org-1", "discovery.listPageSize");
    expect(getApps).toHaveBeenCalledWith({
      filter: { search: "sla", status: "ACTIVE" },
      sort: { sortBy: "name", sortOrder: "asc" },
      page: 2,
      limit: 25,
    });
    expect(result).toEqual({
      success: true,
      data: { items: [{ id: "a" }], total: 1, page: 2, pageSize: 25 },
    });
  });

  it("lists everything with the all filter and no search", async () => {
    await listAppsForMasters({});
    expect(getApps).toHaveBeenCalledWith(
      expect.objectContaining({ filter: {}, page: 1 })
    );
  });

  it("rejects an unknown status before reading data", async () => {
    const result = await listAppsForMasters({
      status: "DELETED" as never,
    });
    expect(result.success).toBe(false);
    expect(getApps).not.toHaveBeenCalled();
  });

  it("returns a failure when the viewer may not read apps", async () => {
    requirePermission.mockRejectedValue(new ForbiddenError("apps:read"));
    const result = await listAppsForMasters({});
    expect(result).toMatchObject({ success: false });
    expect(getApps).not.toHaveBeenCalled();
  });
});
