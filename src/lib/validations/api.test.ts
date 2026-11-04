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
  it("유효한 Google Workspace 입력을 통과해야 한다", () => {
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

  it("유효한 Microsoft Entra 입력을 통과해야 한다", () => {
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

  it("유효한 Okta 입력을 통과해야 한다", () => {
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

  it("잘못된 타입은 거부해야 한다", () => {
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

  it("credentials가 없으면 거부해야 한다", () => {
    const input = {
      type: "GOOGLE_WORKSPACE",
    };

    const result = createIntegrationApiSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("잘못된 syncFrequency를 거부해야 한다", () => {
    const input = {
      type: "OKTA",
      credentials: { accessToken: "token" },
      metadata: {
        syncFrequency: "minutely", // 유효하지 않음
      },
    };

    const result = createIntegrationApiSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("metadata의 totalUsers가 음수면 거부해야 한다", () => {
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
  it("부분 업데이트를 허용해야 한다", () => {
    const input = {
      metadata: {
        syncFrequency: "weekly",
      },
    };

    const result = updateIntegrationApiSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("빈 객체를 허용해야 한다", () => {
    const result = updateIntegrationApiSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("credentials만 업데이트할 수 있어야 한다", () => {
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
  it("유효한 UUID를 통과해야 한다", () => {
    const validUuids = [
      "123e4567-e89b-12d3-a456-426614174000",
      "550e8400-e29b-41d4-a716-446655440000",
    ];

    validUuids.forEach((uuid) => {
      const result = uuidParamSchema.safeParse(uuid);
      expect(result.success).toBe(true);
    });
  });

  it("cuid를 통과해야 한다", () => {
    // Prisma cuid 형식
    const cuids = ["cm3w72qcv0000mpz2g5xh7r0t", "clh1234567890abcdefghijklm"];

    cuids.forEach((cuid) => {
      const result = uuidParamSchema.safeParse(cuid);
      expect(result.success).toBe(true);
    });
  });

  it("유효하지 않은 ID를 거부해야 한다", () => {
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
  it("기본값을 사용해야 한다", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("유효한 페이지네이션 파라미터를 통과해야 한다", () => {
    const input = { page: 5, limit: 50 };
    const result = paginationSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(5);
      expect(result.data.limit).toBe(50);
    }
  });

  it("페이지가 1 미만이면 거부해야 한다", () => {
    const result = paginationSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it("limit이 100 초과면 거부해야 한다", () => {
    const result = paginationSchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it("limit이 1 미만이면 거부해야 한다", () => {
    const result = paginationSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });
});

describe("formatValidationError", () => {
  it("Zod 에러를 포맷팅해야 한다", () => {
    const schema = z.object({ name: z.string().min(1) });
    const result = schema.safeParse({ name: "" });

    if (!result.success) {
      const formatted = formatValidationError(result.error);
      expect(formatted.error).toBe("입력 검증 실패");
      expect(formatted.details).toBeDefined();
    }
  });
});
