// src/lib/services/notification/push/provider.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFcmHttpProvider,
  getPushProvider,
  logOnlyProvider,
  setPushProviderForTests,
} from "./provider";

describe("push providers", () => {
  afterEach(() => {
    setPushProviderForTests(null);
    vi.unstubAllEnvs();
  });

  it("log-only provider sends nothing", async () => {
    const res = await logOnlyProvider.send([{ token: "t", platform: "IOS" }], {
      title: "x",
    });
    expect(res).toEqual({ sent: 0, failed: 0, invalidTokens: [] });
  });

  it("resolves the provider from FCM_SERVER_KEY", () => {
    vi.stubEnv("FCM_SERVER_KEY", "");
    expect(getPushProvider().name).toBe("log-only");
    setPushProviderForTests(null);
    vi.stubEnv("FCM_SERVER_KEY", "key");
    expect(getPushProvider().name).toBe("fcm-http");
  });

  it("FCM provider posts registration ids and reports invalid tokens", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: 1,
        failure: 1,
        results: [{ message_id: "m" }, { error: "NotRegistered" }],
      }),
    });
    const provider = createFcmHttpProvider(
      "secret",
      fetchImpl as unknown as typeof fetch
    );

    const res = await provider.send(
      [
        { token: "good", platform: "ANDROID" },
        { token: "stale", platform: "ANDROID" },
      ],
      { title: "Hello", body: "World", link: "/x" }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://fcm.googleapis.com/fcm/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "key=secret" }),
      })
    );
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.registration_ids).toEqual(["good", "stale"]);
    expect(res).toEqual({ sent: 1, failed: 1, invalidTokens: ["stale"] });
  });

  it("FCM provider degrades gracefully on network/HTTP errors", async () => {
    const failing = createFcmHttpProvider(
      "k",
      vi.fn().mockRejectedValue(new Error("net")) as never
    );
    expect(
      await failing.send([{ token: "a", platform: "WEB" }], { title: "t" })
    ).toEqual({
      sent: 0,
      failed: 1,
      invalidTokens: [],
    });
    const http500 = createFcmHttpProvider(
      "k",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }) as never
    );
    expect(
      (await http500.send([{ token: "a", platform: "WEB" }], { title: "t" }))
        .failed
    ).toBe(1);
    expect(await http500.send([], { title: "t" })).toEqual({
      sent: 0,
      failed: 0,
      invalidTokens: [],
    });
  });
});
