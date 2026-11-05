import { withLogging } from "@/lib/logging";
import { beforeEach, describe, expect, it, vi } from "vitest";

// logger mock
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: {
    info: (...args: unknown[]) => mockInfo(...args),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: (...args: unknown[]) => mockError(...args),
  },
}));

// Helper that mimics NextRequest/NextResponse (supports clone)
function fakeRequest(method: string, url: string, body?: unknown) {
  const makeReq = (): Record<string, unknown> => ({
    method,
    url,
    headers: new Headers(),
    json: () => Promise.resolve(body),
    clone: () => makeReq(),
  });
  return makeReq();
}

function fakeResponse(status: number, body: unknown = {}) {
  const makeRes = (): Record<string, unknown> => ({
    status,
    json: () => Promise.resolve(body),
    clone: () => makeRes(),
  });
  return makeRes();
}

describe("withLogging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Basic behaviour ───

  describe("basic behaviour", () => {
    it("should log 'start' and 'done' for successful execution", async () => {
      const fn = vi.fn().mockResolvedValue({ data: "test" });
      const wrapped = withLogging("GET /api/v1/apps", fn);

      await wrapped();

      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({ name: "GET /api/v1/apps" }),
        "start"
      );
      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "GET /api/v1/apps",
          durationMs: expect.any(Number),
        }),
        "done"
      );
    });

    it("should return the original function result", async () => {
      const expected = { success: true, data: [1, 2, 3] };
      const fn = vi.fn().mockResolvedValue(expected);
      const wrapped = withLogging("getApps", fn);

      const result = await wrapped();

      expect(result).toEqual(expected);
    });

    it("should pass arguments to the original function", async () => {
      const fn = vi.fn().mockResolvedValue("ok");
      const wrapped = withLogging("createApp", fn);

      await wrapped("arg1", { key: "value" }, 42);

      expect(fn).toHaveBeenCalledWith("arg1", { key: "value" }, 42);
    });

    it("should measure duration (durationMs >= 0)", async () => {
      const fn = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve("done"), 50))
        );
      const wrapped = withLogging("slow-action", fn);

      await wrapped();

      const doneCall = mockInfo.mock.calls.find((call) => call[1] === "done");
      expect(doneCall).toBeDefined();
      expect(doneCall![0].durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── HTTP status code detection ───

  describe("HTTP status code detection", () => {
    it("should log status 200 at info level", async () => {
      const fn = vi.fn().mockResolvedValue(fakeResponse(200, { data: [] }));
      const wrapped = withLogging("GET /api/v1/apps", fn);

      await wrapped();

      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({ status: 200 }),
        "done"
      );
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it("should log status 400 at warn level", async () => {
      const fn = vi
        .fn()
        .mockResolvedValue(fakeResponse(400, { error: "Validation failed" }));
      const wrapped = withLogging("POST /api/v1/apps", fn);

      await wrapped();

      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({ status: 400 }),
        "done"
      );
      expect(mockInfo).toHaveBeenCalledTimes(1); // only start is info
    });

    it("should log status 401 at warn level", async () => {
      const fn = vi
        .fn()
        .mockResolvedValue(fakeResponse(401, { error: "Unauthorized" }));
      const wrapped = withLogging("GET /api/v1/users", fn);

      await wrapped();

      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401 }),
        "done"
      );
    });

    it("should log status 403 at warn level", async () => {
      const fn = vi
        .fn()
        .mockResolvedValue(fakeResponse(403, { error: "Forbidden" }));
      const wrapped = withLogging("DELETE /api/v1/apps/1", fn);

      await wrapped();

      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
        "done"
      );
    });

    it("should log status 500 at warn level", async () => {
      const fn = vi
        .fn()
        .mockResolvedValue(fakeResponse(500, { error: "Internal error" }));
      const wrapped = withLogging("cron:sync-sso", fn);

      await wrapped();

      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({ status: 500 }),
        "done"
      );
    });

    it("should handle result without status (Server Action)", async () => {
      const fn = vi
        .fn()
        .mockResolvedValue({ success: true, data: { id: "123" } });
      const wrapped = withLogging("createApp", fn);

      await wrapped();

      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({ name: "createApp", status: undefined }),
        "done"
      );
    });
  });

  // ─── NextRequest auto-detection ───

  describe("NextRequest auto-detection", () => {
    it("should extract method and path from request-like first arg", async () => {
      const req = fakeRequest(
        "GET",
        "http://localhost:3000/api/v1/apps?page=1"
      );
      const fn = vi.fn().mockResolvedValue(fakeResponse(200));
      const wrapped = withLogging("GET /api/v1/apps", fn);

      await wrapped(req);

      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "GET /api/v1/apps",
          method: "GET",
          path: "/api/v1/apps",
        }),
        "start"
      );

      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          path: "/api/v1/apps",
          status: 200,
        }),
        "done"
      );
    });

    it("should extract POST method", async () => {
      const req = fakeRequest(
        "POST",
        "http://localhost:3000/api/v1/subscriptions"
      );
      const fn = vi.fn().mockResolvedValue(fakeResponse(200));
      const wrapped = withLogging("POST /api/v1/subscriptions", fn);

      await wrapped(req);

      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          path: "/api/v1/subscriptions",
        }),
        "start"
      );
    });

    it("should include method/path in error log on throw", async () => {
      const req = fakeRequest("DELETE", "http://localhost:3000/api/v1/apps/1");
      const fn = vi.fn().mockRejectedValue(new Error("DB error"));
      const wrapped = withLogging("DELETE /api/v1/apps/1", fn);

      await expect(wrapped(req)).rejects.toThrow("DB error");

      expect(mockError).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "DELETE",
          path: "/api/v1/apps/1",
          err: expect.any(Error),
        }),
        "fail"
      );
    });

    it("should handle non-request first arg gracefully (Server Action)", async () => {
      const fn = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withLogging("getApps", fn);

      await wrapped({ page: 1, limit: 20 });

      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "getApps",
          method: undefined,
          path: undefined,
        }),
        "start"
      );
    });

    it("should handle no arguments gracefully", async () => {
      const fn = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withLogging("healthCheck", fn);

      await wrapped();

      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "healthCheck",
          method: undefined,
          path: undefined,
        }),
        "start"
      );
    });

    it("should not extract payload for HTTP requests", async () => {
      const req = fakeRequest("GET", "http://localhost:3000/api/v1/apps");
      const fn = vi.fn().mockResolvedValue(fakeResponse(200));
      const wrapped = withLogging("GET /api/v1/apps", fn);

      await wrapped(req);

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].payload).toBeUndefined();
    });
  });

  // ─── Server Action payload logging ───

  describe("Server Action payload logging", () => {
    it("should convert FormData to plain object in payload", async () => {
      const fd = new FormData();
      fd.set("name", "Slack");
      fd.set("category", "Communication");

      const fn = vi
        .fn()
        .mockResolvedValue({ success: true, data: { id: "1" } });
      const wrapped = withLogging("createApp", fn);

      await wrapped({ success: true }, fd); // prevState + FormData

      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "createApp",
          payload: { name: "Slack", category: "Communication" },
        }),
        "start"
      );
    });

    it("should exclude prevState (ActionState) from payload", async () => {
      const prevState = { success: false, message: "Previous error" };
      const fd = new FormData();
      fd.set("name", "Notion");

      const fn = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withLogging("createApp", fn);

      await wrapped(prevState, fd);

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].payload).toEqual({ name: "Notion" });
    });

    it("should keep id and exclude prevState in (id, prevState, FormData) pattern", async () => {
      const fd = new FormData();
      fd.set("name", "Updated");

      const fn = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withLogging("updateApp", fn);

      await wrapped("app-123", { success: true }, fd);

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].payload).toEqual(["app-123", { name: "Updated" }]);
    });

    it("should log plain object args directly", async () => {
      const input = {
        type: "GOOGLE_WORKSPACE",
        credentials: { email: "admin@test.com" },
      };
      const fn = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withLogging("createIntegration", fn);

      await wrapped(input);

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].payload).toEqual(input);
    });

    it("should set payload to undefined when no args", async () => {
      const fn = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withLogging("deleteAccount", fn);

      await wrapped();

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].payload).toBeUndefined();
    });

    it("should log simple id arg as payload", async () => {
      const fn = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withLogging("deleteApp", fn);

      await wrapped("app-123");

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].payload).toBe("app-123");
    });

    it("should handle multiple primitive args as array", async () => {
      const fn = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withLogging("updateNotificationSettings", fn);

      await wrapped("sub-123", "renewalAlert30", true);

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].payload).toEqual([
        "sub-123",
        "renewalAlert30",
        true,
      ]);
    });
  });

  // ─── ActionState result summary ───

  describe("ActionState result summary", () => {
    it("should log success:true at info level with actual data", async () => {
      const fn = vi
        .fn()
        .mockResolvedValue({ success: true, data: { id: "123" } });
      const wrapped = withLogging("createApp", fn);

      await wrapped();

      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "createApp",
          result: { success: true, data: { id: "123" } },
        }),
        "done"
      );
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it("should log success:false at warn level with message", async () => {
      const fn = vi.fn().mockResolvedValue({
        success: false,
        message: "An app with this name already exists",
      });
      const wrapped = withLogging("createApp", fn);

      await wrapped();

      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "createApp",
          result: {
            success: false,
            message: "An app with this name already exists",
          },
        }),
        "done"
      );
    });

    it("should log success:false with validation errors at warn level", async () => {
      const fn = vi.fn().mockResolvedValue({
        success: false,
        errors: { name: ["App name must be at least 2 characters"] },
      });
      const wrapped = withLogging("createApp", fn);

      await wrapped();

      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          result: {
            success: false,
            errors: { name: ["App name must be at least 2 characters"] },
          },
        }),
        "done"
      );
    });

    it("should include actual data object in result", async () => {
      const fn = vi.fn().mockResolvedValue({
        success: true,
        data: { id: "1", name: "Slack", category: "Communication" },
      });
      const wrapped = withLogging("createApp", fn);

      await wrapped();

      const doneCall = mockInfo.mock.calls.find((c) => c[1] === "done");
      expect(doneCall![0].result.data).toEqual({
        id: "1",
        name: "Slack",
        category: "Communication",
      });
    });

    it("should summarize array data as string", async () => {
      const fn = vi.fn().mockResolvedValue({
        success: true,
        data: [{ id: "1" }, { id: "2" }, { id: "3" }],
      });
      const wrapped = withLogging("getApps", fn);

      await wrapped();

      const doneCall = mockInfo.mock.calls.find((c) => c[1] === "done");
      expect(doneCall![0].result.data).toBe("[Array: 3 items]");
    });

    it("should not include result for non-ActionState returns", async () => {
      const fn = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1 });
      const wrapped = withLogging("getApps", fn);

      await wrapped();

      const doneCall = mockInfo.mock.calls.find((c) => c[1] === "done");
      expect(doneCall![0].result).toBeUndefined();
    });
  });

  // ─── Error cases ───

  describe("logging on error", () => {
    it("should log 'start' and 'fail' when function throws", async () => {
      const error = new Error("DB connection failed");
      const fn = vi.fn().mockRejectedValue(error);
      const wrapped = withLogging("POST /api/v1/apps", fn);

      await expect(wrapped()).rejects.toThrow("DB connection failed");

      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({ name: "POST /api/v1/apps" }),
        "start"
      );
      expect(mockError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "POST /api/v1/apps",
          durationMs: expect.any(Number),
          err: error,
        }),
        "fail"
      );
    });

    it("should re-throw the original error", async () => {
      const error = new Error("Unauthorized");
      const fn = vi.fn().mockRejectedValue(error);
      const wrapped = withLogging("auth-check", fn);

      await expect(wrapped()).rejects.toThrow(error);
    });

    it("should handle non-Error thrown values", async () => {
      const fn = vi.fn().mockRejectedValue("string error");
      const wrapped = withLogging("string-err", fn);

      await expect(wrapped()).rejects.toBe("string error");

      expect(mockError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "string-err",
          err: "string error",
        }),
        "fail"
      );
    });

    it("should log 1 info (start) + 1 error (fail), no warn", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"));
      const wrapped = withLogging("fail-action", fn);

      await expect(wrapped()).rejects.toThrow();

      expect(mockInfo).toHaveBeenCalledTimes(1);
      expect(mockError).toHaveBeenCalledTimes(1);
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it("should include payload in fail log for Server Actions", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("DB error"));
      const wrapped = withLogging("createApp", fn);

      const fd = new FormData();
      fd.set("name", "Slack");

      await expect(wrapped({ success: true }, fd)).rejects.toThrow("DB error");

      expect(mockError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "createApp",
          payload: { name: "Slack" },
          err: expect.any(Error),
        }),
        "fail"
      );
    });
  });

  // ─── Prisma error normalisation ───

  describe("Prisma error normalisation", () => {
    it("should sanitize PrismaClientKnownRequestError to compact format", async () => {
      // Error that mimics a Prisma error (with code + meta)
      const prismaError = new Error(
        [
          "",
          "Invalid `prisma.app.create()` invocation in",
          "/Users/jaeho/.next/server/chunks/[root]__abc123._.js:1260:216",
          "",
          "  1257 // Parse tags",
          "  1258 const tags = data.tags;",
          "  1259 // Create app",
          "→ 1260 const app = await prisma.app.create(",
          "Foreign key constraint violated on the constraint: `apps_organization_id_fkey`",
        ].join("\n")
      );
      Object.assign(prismaError, {
        code: "P2003",
        meta: { modelName: "App", constraint: "apps_organization_id_fkey" },
        clientVersion: "6.19.0",
        name: "PrismaClientKnownRequestError",
      });

      const fn = vi.fn().mockRejectedValue(prismaError);
      const wrapped = withLogging("createApp", fn);

      await expect(wrapped()).rejects.toThrow();

      const failCall = mockError.mock.calls.find((c) => c[1] === "fail");
      const logged = failCall![0].err;

      // Verify only the key fields are included
      expect(logged).toEqual({
        type: "PrismaClientKnownRequestError",
        code: "P2003",
        message:
          "Foreign key constraint violated on the constraint: `apps_organization_id_fkey`",
        meta: { modelName: "App", constraint: "apps_organization_id_fkey" },
      });

      // Verify there is no stack trace or source snippet
      expect(logged).not.toHaveProperty("stack");
      expect(JSON.stringify(logged)).not.toContain("TURBOPACK");
      expect(JSON.stringify(logged)).not.toContain(".js:");
    });

    it("should pass through regular Error unchanged", async () => {
      const error = new Error("Something went wrong");
      const fn = vi.fn().mockRejectedValue(error);
      const wrapped = withLogging("someAction", fn);

      await expect(wrapped()).rejects.toThrow();

      const failCall = mockError.mock.calls.find((c) => c[1] === "fail");
      expect(failCall![0].err).toBe(error);
    });

    it("should pass through non-Error values unchanged", async () => {
      const fn = vi.fn().mockRejectedValue("string error");
      const wrapped = withLogging("someAction", fn);

      await expect(wrapped()).rejects.toBe("string error");

      const failCall = mockError.mock.calls.find((c) => c[1] === "fail");
      expect(failCall![0].err).toBe("string error");
    });

    it("should sanitize P2002 unique constraint error", async () => {
      const prismaError = new Error(
        [
          "",
          "Invalid `prisma.user.create()` invocation in",
          "/app/.next/server/chunks/abc.js:100:50",
          "",
          "Unique constraint failed on the fields: (`email`)",
        ].join("\n")
      );
      Object.assign(prismaError, {
        code: "P2002",
        meta: { modelName: "User", target: ["email"] },
        clientVersion: "6.19.0",
        name: "PrismaClientKnownRequestError",
      });

      const fn = vi.fn().mockRejectedValue(prismaError);
      const wrapped = withLogging("createUser", fn);

      await expect(wrapped()).rejects.toThrow();

      const failCall = mockError.mock.calls.find((c) => c[1] === "fail");
      const logged = failCall![0].err;

      expect(logged).toEqual({
        type: "PrismaClientKnownRequestError",
        code: "P2002",
        message: "Unique constraint failed on the fields: (`email`)",
        meta: { modelName: "User", target: ["email"] },
      });
    });
  });

  // ─── Query params logging ───

  describe("query params logging", () => {
    it("should extract query params from URL in start log", async () => {
      const req = fakeRequest(
        "GET",
        "http://localhost:3000/api/v1/apps?page=1&limit=20&status=ACTIVE"
      );
      const fn = vi.fn().mockResolvedValue(fakeResponse(200, { items: [] }));
      const wrapped = withLogging("GET /api/v1/apps", fn);

      await wrapped(req);

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].query).toEqual({
        page: "1",
        limit: "20",
        status: "ACTIVE",
      });
    });

    it("should set query to undefined when no query params", async () => {
      const req = fakeRequest("GET", "http://localhost:3000/api/v1/apps");
      const fn = vi.fn().mockResolvedValue(fakeResponse(200));
      const wrapped = withLogging("GET /api/v1/apps", fn);

      await wrapped(req);

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].query).toBeUndefined();
    });

    it("should not extract query for non-HTTP (Server Action)", async () => {
      const fn = vi.fn().mockResolvedValue({ success: true });
      const wrapped = withLogging("getApps", fn);

      await wrapped({ page: 1 });

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].query).toBeUndefined();
    });
  });

  // ─── Request body logging ───

  describe("request body logging", () => {
    it("should log request body for POST requests", async () => {
      const reqBody = { name: "Slack", category: "Communication" };
      const req = fakeRequest(
        "POST",
        "http://localhost:3000/api/v1/apps",
        reqBody
      );
      const fn = vi.fn().mockResolvedValue(fakeResponse(200));
      const wrapped = withLogging("POST /api/v1/apps", fn);

      await wrapped(req);

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].body).toEqual(reqBody);
    });

    it("should log request body for PATCH requests", async () => {
      const reqBody = { name: "Updated Slack" };
      const req = fakeRequest(
        "PATCH",
        "http://localhost:3000/api/v1/apps/1",
        reqBody
      );
      const fn = vi.fn().mockResolvedValue(fakeResponse(200));
      const wrapped = withLogging("PATCH /api/v1/apps/1", fn);

      await wrapped(req);

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].body).toEqual(reqBody);
    });

    it("should not log request body for GET requests", async () => {
      const req = fakeRequest("GET", "http://localhost:3000/api/v1/apps");
      const fn = vi.fn().mockResolvedValue(fakeResponse(200));
      const wrapped = withLogging("GET /api/v1/apps", fn);

      await wrapped(req);

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].body).toBeUndefined();
    });

    it("should handle clone not available gracefully", async () => {
      // request without clone support (legacy compatibility)
      const req = { method: "POST", url: "http://localhost:3000/api/v1/apps" };
      const fn = vi.fn().mockResolvedValue({ status: 200 });
      const wrapped = withLogging("POST /api/v1/apps", fn);

      await wrapped(req);

      const startCall = mockInfo.mock.calls.find((c) => c[1] === "start");
      expect(startCall![0].body).toBeUndefined();
    });
  });

  // ─── Response body logging ───

  describe("response body logging", () => {
    it("should log response body in done log for API routes", async () => {
      const resBody = { success: true, data: { id: "123" } };
      const req = fakeRequest("POST", "http://localhost:3000/api/v1/apps");
      const fn = vi.fn().mockResolvedValue(fakeResponse(200, resBody));
      const wrapped = withLogging("POST /api/v1/apps", fn);

      await wrapped(req);

      const doneCall = mockInfo.mock.calls.find((c) => c[1] === "done");
      expect(doneCall![0].responseBody).toEqual(resBody);
    });

    it("should summarize arrays in response body", async () => {
      const resBody = {
        items: [{ id: "1" }, { id: "2" }, { id: "3" }],
        total: 3,
        page: 1,
        limit: 20,
      };
      const req = fakeRequest("GET", "http://localhost:3000/api/v1/apps");
      const fn = vi.fn().mockResolvedValue(fakeResponse(200, resBody));
      const wrapped = withLogging("GET /api/v1/apps", fn);

      await wrapped(req);

      const doneCall = mockInfo.mock.calls.find((c) => c[1] === "done");
      expect(doneCall![0].responseBody).toEqual({
        items: "[Array: 3 items]",
        total: 3,
        page: 1,
        limit: 20,
      });
    });

    it("should log error response body at warn level", async () => {
      const resBody = { message: "Unauthorized" };
      const req = fakeRequest("GET", "http://localhost:3000/api/v1/apps");
      const fn = vi.fn().mockResolvedValue(fakeResponse(401, resBody));
      const wrapped = withLogging("GET /api/v1/apps", fn);

      await wrapped(req);

      const doneCall = mockWarn.mock.calls.find((c) => c[1] === "done");
      expect(doneCall![0].responseBody).toEqual(resBody);
    });

    it("should not log responseBody for non-HTTP (Server Action)", async () => {
      const fn = vi
        .fn()
        .mockResolvedValue({ success: true, data: { id: "1" } });
      const wrapped = withLogging("createApp", fn);

      await wrapped();

      const doneCall = mockInfo.mock.calls.find((c) => c[1] === "done");
      expect(doneCall![0].responseBody).toBeUndefined();
    });

    it("should handle clone not available on response gracefully", async () => {
      // response without clone support (legacy compatibility)
      const req = fakeRequest("GET", "http://localhost:3000/api/v1/apps");
      const fn = vi.fn().mockResolvedValue({ status: 200 });
      const wrapped = withLogging("GET /api/v1/apps", fn);

      await wrapped(req);

      const doneCall = mockInfo.mock.calls.find((c) => c[1] === "done");
      expect(doneCall![0].responseBody).toBeUndefined();
    });
  });

  // ─── End-to-end scenarios ───

  describe("end-to-end scenarios", () => {
    it("API success: start(info) → done(info, status:200)", async () => {
      const req = fakeRequest("GET", "http://localhost:3000/api/v1/apps");
      const fn = vi.fn().mockResolvedValue(fakeResponse(200, { items: [] }));
      const wrapped = withLogging("GET /api/v1/apps", fn);

      await wrapped(req);

      expect(mockInfo).toHaveBeenCalledTimes(2);
      expect(mockWarn).not.toHaveBeenCalled();
      expect(mockError).not.toHaveBeenCalled();
    });

    it("API auth failure: start(info) → done(warn, status:401)", async () => {
      const req = fakeRequest("POST", "http://localhost:3000/api/v1/apps");
      const fn = vi.fn().mockResolvedValue(fakeResponse(401));
      const wrapped = withLogging("POST /api/v1/apps", fn);

      await wrapped(req);

      expect(mockInfo).toHaveBeenCalledTimes(1); // start only
      expect(mockWarn).toHaveBeenCalledTimes(1); // done is warn
      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "POST /api/v1/apps",
          status: 401,
          method: "POST",
          path: "/api/v1/apps",
        }),
        "done"
      );
    });

    it("API server error (throw): start(info) → fail(error)", async () => {
      const req = fakeRequest("GET", "http://localhost:3000/api/v1/users");
      const fn = vi.fn().mockRejectedValue(new Error("Connection timeout"));
      const wrapped = withLogging("GET /api/v1/users", fn);

      await expect(wrapped(req)).rejects.toThrow("Connection timeout");

      expect(mockInfo).toHaveBeenCalledTimes(1);
      expect(mockError).toHaveBeenCalledTimes(1);
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it("Server Action success: start(info, payload) → done(info, result)", async () => {
      const fn = vi
        .fn()
        .mockResolvedValue({ success: true, data: { id: "abc" } });
      const wrapped = withLogging("createSubscription", fn);

      const result = await wrapped({ name: "Netflix" });

      expect(result).toEqual({ success: true, data: { id: "abc" } });
      expect(mockInfo).toHaveBeenCalledTimes(2);
      // start includes the payload
      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "createSubscription",
          payload: { name: "Netflix" },
        }),
        "start"
      );
      // done includes the result (with the actual data)
      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          result: { success: true, data: { id: "abc" } },
        }),
        "done"
      );
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it("Server Action failure: start(info, payload) → done(warn, result)", async () => {
      const fn = vi
        .fn()
        .mockResolvedValue({ success: false, message: "App already exists" });
      const wrapped = withLogging("createApp", fn);

      const fd = new FormData();
      fd.set("name", "Slack");

      await wrapped({ success: true }, fd);

      expect(mockInfo).toHaveBeenCalledTimes(1); // start only
      expect(mockWarn).toHaveBeenCalledTimes(1); // done is warn
      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "createApp",
          result: { success: false, message: "App already exists" },
        }),
        "done"
      );
    });
  });
});
