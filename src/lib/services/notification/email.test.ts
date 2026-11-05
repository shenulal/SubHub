// src/lib/services/notification/email.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock send function - must be hoisted
const mockSend = vi.fn();

// Mock Resend - vitest hoists vi.mock calls
vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = {
        send: (...args: unknown[]) => mockSend(...args),
      };
    },
  };
});

// Import after mocking
import {
  EmailConfig,
  sendRenewalAlertEmail,
  sendTerminatedUserAlertEmail,
  sendWelcomeEmail,
} from "./email";

describe("Email Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set RESEND_API_KEY in the test environment (required for lazy init)
    process.env.RESEND_API_KEY = "test-api-key";
    // Default successful response
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
  });

  describe("sendRenewalAlertEmail", () => {
    it("sends a renewal alert e-mail 30 days before", async () => {
      const result = await sendRenewalAlertEmail({
        to: "admin@example.com",
        appName: "Slack",
        renewalDate: new Date("2024-02-15"),
        daysUntilRenewal: 30,
        amount: 100000,
        currency: "KRW",
        organizationName: "Test Organization",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("email-123");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("sends a renewal alert e-mail 60 days before", async () => {
      const result = await sendRenewalAlertEmail({
        to: "admin@example.com",
        appName: "Notion",
        renewalDate: new Date("2024-03-15"),
        daysUntilRenewal: 60,
        amount: 50000,
        currency: "KRW",
        organizationName: "Test Organization",
      });

      expect(result.success).toBe(true);
    });

    it("sends a renewal alert e-mail 90 days before", async () => {
      const result = await sendRenewalAlertEmail({
        to: "admin@example.com",
        appName: "Figma",
        renewalDate: new Date("2024-04-15"),
        daysUntilRenewal: 90,
        amount: 200000,
        currency: "KRW",
        organizationName: "Test Organization",
      });

      expect(result.success).toBe(true);
    });

    it("returns an error when e-mail delivery fails", async () => {
      // Override mock for this test
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Delivery failed" },
      });

      const result = await sendRenewalAlertEmail({
        to: "admin@example.com",
        appName: "Slack",
        renewalDate: new Date("2024-02-15"),
        daysUntilRenewal: 30,
        amount: 100000,
        currency: "KRW",
        organizationName: "Test Organization",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Delivery failed");
    });

    it("returns an error when an exception is thrown", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network error"));

      const result = await sendRenewalAlertEmail({
        to: "admin@example.com",
        appName: "Slack",
        renewalDate: new Date("2024-02-15"),
        daysUntilRenewal: 30,
        amount: 100000,
        currency: "KRW",
        organizationName: "Test Organization",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });
  });

  describe("sendWelcomeEmail", () => {
    it("sends a welcome e-mail", async () => {
      const result = await sendWelcomeEmail({
        to: "newuser@example.com",
        userName: "Ahmed Al Mansoori",
        organizationName: "Test Organization",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("email-123");
    });

    it("returns an error when the welcome e-mail fails", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Email delivery failed" },
      });

      const result = await sendWelcomeEmail({
        to: "newuser@example.com",
        userName: "Ahmed Al Mansoori",
        organizationName: "Test Organization",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email delivery failed");
    });
  });

  describe("sendTerminatedUserAlertEmail", () => {
    it("sends an unrevoked-account alert e-mail for an offboarded user", async () => {
      const result = await sendTerminatedUserAlertEmail({
        to: "admin@example.com",
        terminatedUserName: "Omar Khalid",
        terminatedUserEmail: "kim@example.com",
        unrevokedApps: ["Slack", "Notion", "Figma"],
        terminatedAt: new Date("2024-01-10"),
        organizationName: "Test Organization",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("email-123");
    });

    it("includes multiple apps", async () => {
      const apps = ["Slack", "Notion", "Figma", "Zoom", "GitHub"];

      const result = await sendTerminatedUserAlertEmail({
        to: "admin@example.com",
        terminatedUserName: "Omar Khalid",
        terminatedUserEmail: "kim@example.com",
        unrevokedApps: apps,
        terminatedAt: new Date("2024-01-10"),
        organizationName: "Test Organization",
      });

      expect(result.success).toBe(true);
    });

    it("returns an error when the offboarded-user alert fails", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Alert delivery failed" },
      });

      const result = await sendTerminatedUserAlertEmail({
        to: "admin@example.com",
        terminatedUserName: "Omar Khalid",
        terminatedUserEmail: "kim@example.com",
        unrevokedApps: ["Slack"],
        terminatedAt: new Date("2024-01-10"),
        organizationName: "Test Organization",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Alert delivery failed");
    });
  });

  describe("EmailConfig", () => {
    it("has default settings", () => {
      expect(EmailConfig.fromEmail).toBeDefined();
      expect(EmailConfig.fromName).toBeDefined();
    });

    it("formats the from address correctly", () => {
      expect(EmailConfig.from).toContain(EmailConfig.fromName);
      expect(EmailConfig.from).toContain(EmailConfig.fromEmail);
    });
  });
});
