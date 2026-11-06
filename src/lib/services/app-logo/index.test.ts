// src/lib/services/app-logo/index.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_LOGO_ROUTE,
  decodeImageDataUrl,
  deleteManagedLogo,
  logoKeyFromSegments,
  resolveLogoInput,
  sniffImageType,
} from ".";

const storage = vi.hoisted(() => ({
  putObject: vi.fn(),
  deleteObject: vi.fn(),
}));
const getSetting = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/storage", () => storage);
vi.mock("@/lib/settings/service", () => ({ getSetting }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const dataUrl = (mime: string, body: Buffer) =>
  `data:${mime};base64,${body.toString("base64")}`;

beforeEach(() => {
  vi.resetAllMocks();
  getSetting.mockResolvedValue(512);
  storage.putObject.mockResolvedValue({ key: "k", sizeBytes: PNG.length });
});

describe("app logo service", () => {
  it("detects raster formats from magic bytes", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg"
    );
    expect(sniffImageType(Buffer.from("GIF89a"))).toBe("image/gif");
    expect(sniffImageType(Buffer.from("RIFF0000WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });

  it("stores an uploaded icon on the storage provider under the organisation", async () => {
    const url = await resolveLogoInput("org1", dataUrl("image/png", PNG));
    expect(url).toMatch(
      new RegExp(`^${APP_LOGO_ROUTE}/org1/[a-f0-9-]{36}\\.png$`)
    );
    const [key, body, type] = storage.putObject.mock.calls[0];
    expect(key).toMatch(/^app-logos\/org1\/[a-f0-9-]{36}\.png$/);
    expect(Buffer.compare(body, PNG)).toBe(0);
    expect(type).toBe("image/png");
    expect(getSetting).toHaveBeenCalledWith(
      "org1",
      "documents.appLogoMaxSizeKb"
    );
  });

  it("rejects SVG, non-images disguised as PNG and oversized files", async () => {
    await expect(
      resolveLogoInput("org1", dataUrl("image/svg+xml", Buffer.from("<svg/>")))
    ).rejects.toThrow(/SVG/);
    await expect(
      resolveLogoInput("org1", dataUrl("image/png", Buffer.from("<html>")))
    ).rejects.toThrow(/PNG, JPEG, WebP or GIF/);
    getSetting.mockResolvedValue(16);
    const big = Buffer.concat([PNG, Buffer.alloc(17 * 1024)]);
    await expect(
      resolveLogoInput("org1", dataUrl("image/png", big))
    ).rejects.toThrow(/larger than 16 KB/);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("keeps https URLs and relative paths, refuses other schemes and foreign stored paths", async () => {
    await expect(
      resolveLogoInput("org1", "https://cdn.example.com/a.png")
    ).resolves.toBe("https://cdn.example.com/a.png");
    await expect(
      resolveLogoInput("org1", "/images/apps/slack.png")
    ).resolves.toBe("/images/apps/slack.png");
    await expect(resolveLogoInput("org1", "  ")).resolves.toBeNull();
    await expect(
      resolveLogoInput("org1", "javascript:alert(1)")
    ).rejects.toThrow();
    await expect(
      resolveLogoInput("org1", "//evil.test/x.png")
    ).rejects.toThrow();
    await expect(
      resolveLogoInput(
        "org1",
        `${APP_LOGO_ROUTE}/org2/0b8f3a3e-1d6c-4c55-9a7e-1234567890ab.png`
      )
    ).rejects.toThrow();
  });

  it("parses storage keys from the URL segments strictly", () => {
    expect(
      logoKeyFromSegments(["org1", "0b8f3a3e-1d6c-4c55-9a7e-1234567890ab.png"])
    ).toEqual({
      key: "app-logos/org1/0b8f3a3e-1d6c-4c55-9a7e-1234567890ab.png",
      organizationId: "org1",
    });
    expect(logoKeyFromSegments(["org1", "../secret.png"])).toBeNull();
    expect(logoKeyFromSegments(["org1", "a", "b.png"])).toBeNull();
    expect(() => decodeImageDataUrl("data:text/plain,hi")).toThrow();
  });

  it("deletes only icons it stored", async () => {
    await deleteManagedLogo("https://cdn.example.com/a.png");
    expect(storage.deleteObject).not.toHaveBeenCalled();
    await deleteManagedLogo(
      `${APP_LOGO_ROUTE}/org1/0b8f3a3e-1d6c-4c55-9a7e-1234567890ab.png`
    );
    expect(storage.deleteObject).toHaveBeenCalledWith(
      "app-logos/org1/0b8f3a3e-1d6c-4c55-9a7e-1234567890ab.png"
    );
  });
});
