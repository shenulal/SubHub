// src/app/api/cron/send-reports/route.test.ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    reportSchedule: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/services/report/email-sender", () => ({
  sendReportEmail: vi.fn().mockResolvedValue(undefined),
}));

describe("Send Reports Cron API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 401 when the auth header is missing", async () => {
    const request = new NextRequest("http://localhost/api/cron/send-reports");

    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when the auth header is invalid", async () => {
    const request = new NextRequest("http://localhost/api/cron/send-reports", {
      headers: {
        authorization: "Bearer wrong-secret",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("processes schedules when authentication succeeds", async () => {
    const request = new NextRequest("http://localhost/api/cron/send-reports", {
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.processed).toBe(0);
  });

  it("returns 401 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;

    const request = new NextRequest("http://localhost/api/cron/send-reports", {
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
