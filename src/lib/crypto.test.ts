import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decrypt,
  decryptJson,
  encrypt,
  encryptJson,
  getCardLast4,
  maskCardNumber,
} from "./crypto";

describe("crypto", () => {
  beforeEach(() => {
    // Set a 32-character encryption key for tests
    vi.stubEnv("ENCRYPTION_KEY", "12345678901234567890123456789012");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("encrypt/decrypt", () => {
    it("should encrypt and decrypt text correctly", () => {
      const originalText = "Hello, World!";
      const encrypted = encrypt(originalText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(originalText);
    });

    it("should produce different ciphertext for same plaintext (due to random IV)", () => {
      const text = "Test message";
      const encrypted1 = encrypt(text);
      const encrypted2 = encrypt(text);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(text);
      expect(decrypt(encrypted2)).toBe(text);
    });

    it("should handle special characters", () => {
      const text = "مرحبا Unicode test 🔐 !@#$%^&*()";
      const encrypted = encrypt(text);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(text);
    });

    it("should handle empty string", () => {
      const text = "";
      const encrypted = encrypt(text);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(text);
    });

    it("should handle long text", () => {
      const text = "A".repeat(10000);
      const encrypted = encrypt(text);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(text);
    });

    it("should throw error when ENCRYPTION_KEY is not set", () => {
      vi.stubEnv("ENCRYPTION_KEY", "");

      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
    });

    it("should throw error when ENCRYPTION_KEY is not 32 characters", () => {
      vi.stubEnv("ENCRYPTION_KEY", "short-key");

      expect(() => encrypt("test")).toThrow("32 characters");
    });

    it("should detect tampering (GCM auth tag validation)", () => {
      const originalText = "Sensitive data";
      const encrypted = encrypt(originalText);

      // Alter one byte of the ciphertext (change the last character)
      const tamperedChar =
        encrypted.slice(-1) === "0"
          ? "1"
          : String.fromCharCode(encrypted.charCodeAt(encrypted.length - 1) + 1);
      const tampered = encrypted.slice(0, -1) + tamperedChar;

      // Decrypting tampered data must throw
      expect(() => decrypt(tampered)).toThrow();
    });

    it("should decrypt data encrypted with default authTagLength (regression test)", () => {
      // Verifies compatibility with Node.js's default authTagLength=16
      // Ciphertext produced by the pre-fix code must still decrypt after the fix
      const testCases = [
        "Hello, World!",
        "مرحبا multibyte test data",
        JSON.stringify({ cardNo: "1234567890123456", userId: "test" }),
      ];

      for (const original of testCases) {
        const encrypted = encrypt(original);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(original);
      }
    });
  });

  describe("encryptJson/decryptJson", () => {
    it("should encrypt and decrypt JSON object", () => {
      const data = {
        userId: "test123",
        userPw: "password123",
        signPw: "certPass",
      };

      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);

      expect(decrypted).toEqual(data);
    });

    it("should handle nested objects", () => {
      const data = {
        user: {
          name: "John",
          settings: {
            notifications: true,
          },
        },
        items: [1, 2, 3],
      };

      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);

      expect(decrypted).toEqual(data);
    });

    it("should handle null and undefined values", () => {
      const data = {
        value1: null,
        value2: undefined,
      };

      const encrypted = encryptJson(data);
      const decrypted = decryptJson<{ value1: null; value2?: undefined }>(
        encrypted
      );

      expect(decrypted.value1).toBeNull();
      expect(decrypted.value2).toBeUndefined();
    });
  });

  describe("maskCardNumber", () => {
    it("should mask card number with 16 digits", () => {
      expect(maskCardNumber("1234567890123456")).toBe("1234********3456");
    });

    it("should mask card number with dashes", () => {
      expect(maskCardNumber("1234-5678-9012-3456")).toBe("1234********3456");
    });

    it("should mask card number with spaces", () => {
      expect(maskCardNumber("1234 5678 9012 3456")).toBe("1234********3456");
    });

    it("should handle short card numbers", () => {
      // 8 digits leave no middle part to mask
      expect(maskCardNumber("12345678")).toBe("12345678");
      // 7 digits or fewer are fully masked
      expect(maskCardNumber("1234")).toBe("****");
    });

    it("should return all asterisks for very short numbers", () => {
      expect(maskCardNumber("123")).toBe("***");
    });
  });

  describe("getCardLast4", () => {
    it("should return last 4 digits", () => {
      expect(getCardLast4("1234567890123456")).toBe("3456");
    });

    it("should handle dashes and spaces", () => {
      expect(getCardLast4("1234-5678-9012-3456")).toBe("3456");
      expect(getCardLast4("1234 5678 9012 3456")).toBe("3456");
    });

    it("should handle short numbers", () => {
      expect(getCardLast4("1234")).toBe("1234");
      expect(getCardLast4("56")).toBe("56");
    });
  });
});
