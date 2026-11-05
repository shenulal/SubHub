// src/lib/validations/api.test.ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createIntegrationApiSchema,
  formatValidationError,
  paginationSchema,
  updateIntegrationApiSchema,
  uuidParamSchema,
} from "./api";

describe("createIntegrationApiSchema", () => {
  it("accepts valid Google Workspace input", () => {
    const input = {
      type: "GOOGLE_WORKSPACE",
      credentials: {
        serviceAccountEmail: "service@project.iam.gserviceaccount.com",
        privateKey:
          "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----",
        adminEmail: "admin@example.com",
      },
    };

    const result = createIntegrationApiSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts valid Microsoft Entra input", () => {
    const input = {
      type: "MICROSOFT_ENTRA",
      credentials: {
        accessToken: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
        refreshToken: "refresh_token_value",
        expiresAt: 1704067200,
      },
    };

    const result = createIntegrationApiSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts valid Okta input", () => {
    const input = {
      type: "OKTA",
      credentials: {
        accessToken: "00abc123...",
      },
      metadata: {
        domain: "company.okta.com",
        syncFrequency: "daily",
      },
    };

    const result = createIntegrationApiSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid type", () => {
    const input = {
      type: "INVALID_TYPE",
      credentials: {},
    };

    const result = createIntegrationApiSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("type");
    }
  });

  it("rejects missing credentials", () => {
    const input = {
      type: "GOOGLE_WORKSPACE",
    };

    const result = createIntegrationApiSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid syncFrequency", () => {
    const input = {
      type: "OKTA",
      credentials: { accessToken: "token" },
      metadata: {
        syncFrequency: "minutely", // invalid
      },
    };

    const result = createIntegrationApiSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects a negative metadata.totalUsers", () => {
    const input = {
      type: "OKTA",
      credentials: { accessToken: "token" },
      metadata: {
        totalUsers: -1,
      },
    };

    const result = createIntegrationApiSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("updateIntegrationApiSchema", () => {
  it("allows partial updates", () => {
    const input = {
      metadata: {
        syncFrequency: "weekly",
      },
    };

    const result = updateIntegrationApiSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("allows an empty object", () => {
    const result = updateIntegrationApiSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("allows updating credentials only", () => {
    const input = {
      credentials: {
        accessToken: "new_token",
      },
    };

    const result = updateIntegrationApiSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("uuidParamSchema", () => {
  it("accepts a valid UUID", () => {
    const validUuids = [
      "123e4567-e89b-12d3-a456-426614174000",
      "550e8400-e29b-41d4-a716-446655440000",
    ];

    validUuids.forEach((uuid) => {
      const result = uuidParamSchema.safeParse(uuid);
      expect(result.success).toBe(true);
    });
  });

  it("accepts a cuid", () => {
    // Prisma cuid format
    const cuids = ["cm3w72qcv0000mpz2g5xh7r0t", "clh1234567890abcdefghijklm"];

    cuids.forEach((cuid) => {
      const result = uuidParamSchema.safeParse(cuid);
      expect(result.success).toBe(true);
    });
  });

  it("rejects an invalid ID", () => {
    const invalidIds = [
      "",
      "123",
      "not-a-valid-id!@#",
      "../../../etc/passwd",
      "<script>alert('xss')</script>",
    ];

    invalidIds.forEach((id) => {
      const result = uuidParamSchema.safeParse(id);
      expect(result.success).toBe(false);
    });
  });
});

describe("paginationSchema", () => {
  it("uses default values", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid pagination parameters", () => {
    const input = { page: 5, limit: 50 };
    const result = paginationSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(5);
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects a page below 1", () => {
    const result = paginationSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a limit above 100", () => {
    const result = paginationSchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects a limit below 1", () => {
    const result = paginationSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });
});

describe("formatValidationError", () => {
  it("formats Zod errors", () => {
    const schema = z.object({ name: z.string().min(1) });
    const result = schema.safeParse({ name: "" });

    if (!result.success) {
      const formatted = formatValidationError(result.error);
      expect(formatted.error).toBe("Input validation failed");
      expect(formatted.details).toBeDefined();
    }
  });
});
