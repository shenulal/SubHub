// src/lib/masters/rejection-reasons.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_REJECTION_REASONS,
  ensureDefaultRejectionReasons,
} from "./rejection-reasons";

const db = vi.hoisted(() => ({
  approvalRejectionReason: { count: vi.fn(), createMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

describe("ensureDefaultRejectionReasons", () => {
  beforeEach(() => vi.clearAllMocks());

  it("seeds the default reasons for a new organisation in order", async () => {
    db.approvalRejectionReason.count.mockResolvedValue(0);
    await ensureDefaultRejectionReasons("org-1");
    const { data } = db.approvalRejectionReason.createMany.mock.calls[0][0];
    expect(data).toHaveLength(DEFAULT_REJECTION_REASONS.length);
    expect(data[0]).toMatchObject({
      organizationId: "org-1",
      code: "BUDGET",
      sortOrder: 0,
    });
    expect(data.map((r: { code: string }) => r.code)).toContain("OTHER");
  });

  it("leaves an organisation that already has reasons untouched", async () => {
    db.approvalRejectionReason.count.mockResolvedValue(3);
    await ensureDefaultRejectionReasons("org-1");
    expect(db.approvalRejectionReason.createMany).not.toHaveBeenCalled();
  });
});
