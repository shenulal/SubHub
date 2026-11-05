import { describe, expect, it } from "vitest";
import {
  getDevOtpOverride,
  isLocalAppUrl,
  shouldLogOtpInsteadOfEmail,
} from "./otp-dev";

const PUBLIC_URL = "https://subhub.hellopixels.ae";
const LOCAL_URL = "http://localhost:3100";

describe("isLocalAppUrl", () => {
  it("recognises loopback hosts only", () => {
    expect(isLocalAppUrl(LOCAL_URL)).toBe(true);
    expect(isLocalAppUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalAppUrl(PUBLIC_URL)).toBe(false);
    expect(isLocalAppUrl("http://localhost.evil.com")).toBe(false);
    expect(isLocalAppUrl(undefined)).toBe(false);
    expect(isLocalAppUrl("not a url")).toBe(false);
  });
});

describe("getDevOtpOverride", () => {
  it("returns the fixed code in development", () => {
    expect(
      getDevOtpOverride({ NODE_ENV: "development", AUTH_DEV_OTP: "246810" })
    ).toBe("246810");
  });
  it("returns the fixed code for a production build served on localhost", () => {
    expect(
      getDevOtpOverride({
        NODE_ENV: "production",
        NEXTAUTH_URL: LOCAL_URL,
        AUTH_DEV_OTP: "246810",
      })
    ).toBe("246810");
  });
  it("never returns a code for a deployed production URL", () => {
    expect(
      getDevOtpOverride({
        NODE_ENV: "production",
        NEXTAUTH_URL: PUBLIC_URL,
        AUTH_DEV_OTP: "246810",
      })
    ).toBeNull();
    expect(
      getDevOtpOverride({ NODE_ENV: "production", AUTH_DEV_OTP: "246810" })
    ).toBeNull();
  });
  it("ignores missing or malformed codes", () => {
    expect(getDevOtpOverride({ NODE_ENV: "development" })).toBeNull();
    expect(
      getDevOtpOverride({ NODE_ENV: "development", AUTH_DEV_OTP: "abc" })
    ).toBeNull();
    expect(
      getDevOtpOverride({ NODE_ENV: "development", AUTH_DEV_OTP: "12345" })
    ).toBeNull();
  });
});

describe("shouldLogOtpInsteadOfEmail", () => {
  it("is true only when no provider is configured in a local environment", () => {
    expect(shouldLogOtpInsteadOfEmail({ NODE_ENV: "development" })).toBe(true);
    expect(
      shouldLogOtpInsteadOfEmail({
        NODE_ENV: "development",
        RESEND_API_KEY: "re_x",
      })
    ).toBe(false);
    expect(
      shouldLogOtpInsteadOfEmail({
        NODE_ENV: "production",
        NEXTAUTH_URL: PUBLIC_URL,
      })
    ).toBe(false);
    expect(shouldLogOtpInsteadOfEmail({ NODE_ENV: "production" })).toBe(false);
  });
});
