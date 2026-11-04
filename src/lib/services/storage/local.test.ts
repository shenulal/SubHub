import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createLocalProvider,
  resolveSafePath,
  signLocalUrl,
  verifyLocalSignature,
} from "./local";
import { sanitizeKey, StorageKeyError } from "./types";

let root: string;

beforeAll(async () => {
  process.env.STORAGE_SIGNING_SECRET = "test-secret";
  root = await mkdtemp(path.join(os.tmpdir(), "subhub-storage-"));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("sanitizeKey", () => {
  it("accepts well-formed nested keys", () => {
    expect(sanitizeKey("org/abc/exports/file-1.zip")).toBe(
      "org/abc/exports/file-1.zip"
    );
  });

  it.each([
    "../etc/passwd",
    "org/../../secret",
    "/absolute/path",
    "org//double",
    "org/.hidden",
    "org\\win",
    "org/sp ace",
    "",
  ])("rejects %s", (bad) => {
    expect(() => sanitizeKey(bad)).toThrow(StorageKeyError);
  });
});

describe("resolveSafePath", () => {
  it("keeps resolved paths inside the root", () => {
    const resolved = resolveSafePath(root, "a/b/c.txt");
    expect(resolved.startsWith(root + path.sep)).toBe(true);
    expect(() => resolveSafePath(root, "../outside.txt")).toThrow(
      StorageKeyError
    );
  });
});

describe("signed urls", () => {
  it("verifies a fresh signature and rejects tampering or expiry", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const sig = signLocalUrl("org/a/file.zip", exp);
    expect(verifyLocalSignature("org/a/file.zip", exp, sig)).toBe(true);
    expect(verifyLocalSignature("org/a/other.zip", exp, sig)).toBe(false);
    expect(
      verifyLocalSignature(
        "org/a/file.zip",
        exp - 120,
        signLocalUrl("org/a/file.zip", exp - 120)
      )
    ).toBe(false);
    expect(verifyLocalSignature("org/a/file.zip", exp, "zz")).toBe(false);
    expect(verifyLocalSignature("org/a/file.zip", Number.NaN, sig)).toBe(false);
  });
});

describe("local provider", () => {
  it("round-trips put / get / signed url / delete", async () => {
    const provider = createLocalProvider(root);
    const put = await provider.putObject(
      "org/o1/exports/u1/a.json",
      Buffer.from('{"ok":true}'),
      "application/json"
    );
    expect(put).toEqual({ key: "org/o1/exports/u1/a.json", sizeBytes: 11 });

    const stored = await provider.getObject("org/o1/exports/u1/a.json");
    expect(stored?.contentType).toBe("application/json");
    expect(stored?.body.toString()).toBe('{"ok":true}');

    const url = await provider.getSignedUrl("org/o1/exports/u1/a.json", 300);
    expect(url).toMatch(
      /^\/api\/files\/org\/o1\/exports\/u1\/a\.json\?exp=\d+&sig=[0-9a-f]{64}$/
    );

    await provider.deleteObject("org/o1/exports/u1/a.json");
    expect(await provider.getObject("org/o1/exports/u1/a.json")).toBeNull();
  });

  it("refuses traversal keys on every operation", async () => {
    const provider = createLocalProvider(root);
    await expect(
      provider.putObject("../x", Buffer.alloc(0), "text/plain")
    ).rejects.toThrow(StorageKeyError);
    await expect(provider.getObject("../x")).rejects.toThrow(StorageKeyError);
    await expect(provider.deleteObject("../x")).rejects.toThrow(
      StorageKeyError
    );
    await expect(provider.getSignedUrl("../x", 10)).rejects.toThrow(
      StorageKeyError
    );
  });
});
