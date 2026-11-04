import { describe, expect, it } from "vitest";
import { buildBundleEntries, rowsToCsv } from "./privacy-bundle";

describe("rowsToCsv", () => {
  it("escapes commas, quotes and newlines and prefixes a BOM", () => {
    const csv = rowsToCsv([
      { a: "plain", b: 'say "hi"', c: "x,y" },
      { a: "line\nbreak", b: null, c: new Date("2026-01-01T00:00:00Z") },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\n");
    expect(lines[0]).toBe("a,b,c");
    expect(lines[1]).toBe('plain,"say ""hi""","x,y"');
    expect(csv).toContain('"line\nbreak",,2026-01-01T00:00:00.000Z');
  });
});

describe("buildBundleEntries", () => {
  it("produces data.json plus one CSV per section", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    const entries = buildBundleEntries(
      {
        user: { id: "u1", email: "a@b.c" } as never,
        subscriptions: [
          {
            id: "s1",
            amount: "12.5",
            currency: "USD",
            billingCycle: "MONTHLY",
            status: "ACTIVE",
            startDate: now,
            renewalDate: null,
            endDate: null,
            tags: [{ tag: { name: "design" } }],
            customFieldValues: [
              { field: { key: "contract", label: "Contract" }, value: "C-1" },
            ],
            comments: [
              { id: "c1", body: "hi", authorId: "u1", createdAt: now },
            ],
          } as never,
        ],
        approvalRequests: [],
        notifications: [],
        preferences: [],
        auditLogs: [],
      },
      now
    );
    expect(entries.map((e) => e.name)).toEqual([
      "data.json",
      "subscriptions.csv",
      "approval-requests.csv",
      "notifications.csv",
      "audit-log.csv",
    ]);
    const json = JSON.parse(entries[0].data as string);
    expect(json.subscriptions[0]).toMatchObject({
      amount: 12.5,
      tags: ["design"],
      customFields: { contract: "C-1" },
    });
    expect(entries[1].data).toContain("design");
    expect(entries[1].data).toContain("contract=C-1");
  });
});
