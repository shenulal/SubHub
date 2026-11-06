// src/app/api/v1/app-logos/[...key]/route.test.ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  user: { id: "u1", organizationId: "org1", role: "MEMBER" },
}));
const getObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/storage", () => ({ getObject }));
vi.mock("@/lib/settings/service", () => ({ getSetting: vi.fn() }));
vi.mock("@/lib/api/auth-middleware", () => ({
  withApiAuth:
    (
      handler: (
        req: NextRequest,
        ctx: { session: typeof session }
      ) => Promise<Response>
    ) =>
    (req: NextRequest) =>
      handler(req, { session }),
}));
vi.mock("@/lib/logging", () => ({
  withLogging: (_name: string, fn: unknown) => fn,
}));

import { GET } from "./route";

const FILE = "0b8f3a3e-1d6c-4c55-9a7e-1234567890ab.png";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const get = (path: string) =>
  GET(new NextRequest(`http://localhost/api/v1/app-logos/${path}`));

beforeEach(() => {
  vi.resetAllMocks();
  session.user.organizationId = "org1";
  session.user.role = "MEMBER";
});

describe("GET /api/v1/app-logos/:org/:file", () => {
  it("streams an icon of the viewer's organisation with safe headers", async () => {
    getObject.mockResolvedValue({ body: PNG, contentType: "image/png" });
    const res = await get(`org1/${FILE}`);
    expect(res.status).toBe(200);
    expect(getObject).toHaveBeenCalledWith(`app-logos/org1/${FILE}`);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
  });

  it("hides other organisations' icons and malformed keys", async () => {
    expect((await get(`org2/${FILE}`)).status).toBe(404);
    expect((await get(`org1/..%2Fsecret.png`)).status).toBe(404);
    expect(getObject).not.toHaveBeenCalled();
  });

  it("does not serve stored bytes that are not an image", async () => {
    getObject.mockResolvedValue({
      body: Buffer.from("<script>"),
      contentType: "image/png",
    });
    expect((await get(`org1/${FILE}`)).status).toBe(404);
  });
});
