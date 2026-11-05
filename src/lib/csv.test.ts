// src/lib/csv.test.ts
import { describe, expect, it } from "vitest";
import { parseCSV, validateAppCSV, validateSubscriptionCSV } from "./csv";

// Category master rows the import resolves against.
const CATEGORIES = [
  { id: "c-collab", name: "Collaboration", slug: "collaboration" },
  { id: "c-prod", name: "Productivity", slug: "productivity" },
  { id: "c-it", name: "IT Infrastructure", slug: "it-infra" },
];

describe("CSV Utils", () => {
  describe("parseCSV", () => {
    it("should parse a basic CSV", () => {
      const csv = `name,category,vendor
Slack,COLLABORATION,Slack Technologies
Notion,PRODUCTIVITY,Notion Labs`;

      const result = parseCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "Slack",
        category: "COLLABORATION",
        vendor: "Slack Technologies",
      });
      expect(result[1]).toEqual({
        name: "Notion",
        category: "PRODUCTIVITY",
        vendor: "Notion Labs",
      });
    });

    it("should handle quoted fields containing commas", () => {
      const csv = `name,description
"Slack, Inc","Team messaging, file sharing"`;

      const result = parseCSV(csv);

      expect(result[0]).toEqual({
        name: "Slack, Inc",
        description: "Team messaging, file sharing",
      });
    });

    it("should return an empty array for an empty CSV", () => {
      const csv = `name,category`;

      const result = parseCSV(csv);

      expect(result).toHaveLength(0);
    });

    it("should return an empty array for a header-only CSV", () => {
      const csv = `name,category,vendor
`;

      const result = parseCSV(csv);

      expect(result).toHaveLength(0);
    });

    it("should handle line breaks correctly", () => {
      const csv = `name,category\r\nSlack,COLLABORATION\r\nNotion,PRODUCTIVITY`;

      const result = parseCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Slack");
      expect(result[1].name).toBe("Notion");
    });
  });

  describe("validateAppCSV", () => {
    it("should validate valid app data", () => {
      const rows: Record<string, string>[] = [
        { name: "Slack", category: "COLLABORATION", vendor: "Slack Inc" },
        { name: "Notion", category: "PRODUCTIVITY", vendor: "" },
      ];

      const result = validateAppCSV(rows, CATEGORIES);

      expect(result.valid).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it("should flag rows with missing required fields as errors", () => {
      const rows = [
        { name: "", category: "COLLABORATION" },
        { name: "Slack", category: "" },
      ];

      const result = validateAppCSV(rows, CATEGORIES);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].row).toBe(1);
      expect(result.errors[0].message).toContain("name");
      expect(result.errors[1].row).toBe(2);
      expect(result.errors[1].message).toContain("Category");
    });

    it("should flag an invalid category as an error", () => {
      const rows = [{ name: "Slack", category: "INVALID_CATEGORY" }];

      const result = validateAppCSV(rows, CATEGORIES);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("category");
    });

    it("should accept master categories by name or slug, any case", () => {
      const inputs = ["COLLABORATION", "productivity", "IT_INFRA", "it infra"];

      inputs.forEach((category) => {
        const rows = [{ name: "Test App", category }];
        const result = validateAppCSV(rows, CATEGORIES);

        expect(result.valid).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
      });
    });

    it("maps a row to the master category id and name", () => {
      const result = validateAppCSV(
        [{ name: "Slack", category: "COLLABORATION" }],
        CATEGORIES
      );
      expect(result.valid[0]).toMatchObject({
        category: "Collaboration",
        categoryId: "c-collab",
      });
    });
  });

  describe("validateSubscriptionCSV", () => {
    it("should validate valid subscription data", () => {
      const rows = [
        {
          appName: "Slack",
          planName: "Business+",
          billingCycle: "MONTHLY",
          price: "100000",
          renewalDate: "2024-12-01",
        },
        {
          appName: "Notion",
          planName: "Team",
          billingCycle: "YEARLY",
          price: "120000",
          renewalDate: "2025-01-15",
        },
      ];

      const result = validateSubscriptionCSV(rows);

      expect(result.valid).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it("should flag rows with missing required fields as errors", () => {
      const rows = [
        { appName: "", planName: "Business", billingCycle: "MONTHLY" },
        { appName: "Slack", planName: "", billingCycle: "MONTHLY" },
      ];

      const result = validateSubscriptionCSV(rows);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
    });

    it("should flag an invalid billing cycle as an error", () => {
      const rows = [
        { appName: "Slack", planName: "Business", billingCycle: "WEEKLY" },
      ];

      const result = validateSubscriptionCSV(rows);

      expect(result.valid).toHaveLength(0);
      expect(result.errors[0].message).toContain("billing cycle");
    });

    it("should flag an invalid date format as an error", () => {
      const rows = [
        {
          appName: "Slack",
          planName: "Business",
          billingCycle: "MONTHLY",
          renewalDate: "not-a-date",
        },
      ];

      const result = validateSubscriptionCSV(rows);

      expect(result.valid).toHaveLength(0);
      expect(result.errors[0].message).toContain("date");
    });

    it("should flag a non-numeric price as an error", () => {
      const rows = [
        {
          appName: "Slack",
          planName: "Business",
          billingCycle: "MONTHLY",
          price: "not-a-number",
        },
      ];

      const result = validateSubscriptionCSV(rows);

      expect(result.valid).toHaveLength(0);
      expect(result.errors[0].message).toContain("Price");
    });
  });

  describe("validateUserCSV", () => {
    it("should validate a valid user CSV", async () => {
      const { validateUserCSV } = await import("./csv");
      const rows = [
        {
          email: "john@example.com",
          name: "John Doe",
          role: "MEMBER",
          department: "Engineering",
          jobTitle: "Software Engineer",
          employeeId: "EMP001",
        },
        {
          email: "jane@example.com",
          name: "Jane Smith",
          role: "ADMIN",
          department: "HR",
          jobTitle: "HR Manager",
          employeeId: "EMP002",
        },
      ];

      const result = validateUserCSV(rows);

      expect(result.valid).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.valid[0].email).toBe("john@example.com");
      expect(result.valid[0].role).toBe("MEMBER");
      expect(result.valid[1].role).toBe("ADMIN");
    });

    it("should return errors when required fields are missing", async () => {
      const { validateUserCSV } = await import("./csv");
      const rows = [
        { email: "", name: "John", role: "MEMBER" }, // missing email
        { email: "jane@example.com", name: "Jane", role: "" }, // missing role
      ];

      const result = validateUserCSV(rows);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].field).toBe("email");
      expect(result.errors[0].message).toContain("Email");
      expect(result.errors[1].field).toBe("role");
      expect(result.errors[1].message).toContain("Role");
    });

    it("should return an error for an invalid role value", async () => {
      const { validateUserCSV } = await import("./csv");
      const rows = [
        { email: "john@example.com", name: "John", role: "SUPERADMIN" },
      ];

      const result = validateUserCSV(rows);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("role");
      expect(result.errors[0].message).toContain("role");
    });

    it("should return an error for an invalid email format", async () => {
      const { validateUserCSV } = await import("./csv");
      const rows = [
        { email: "invalid-email", name: "John", role: "MEMBER" },
        { email: "no-at-sign.com", name: "Jane", role: "ADMIN" },
      ];

      const result = validateUserCSV(rows);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].field).toBe("email");
      expect(result.errors[0].message).toContain("email");
    });

    it("should return an error for duplicate emails", async () => {
      const { validateUserCSV } = await import("./csv");
      const rows = [
        { email: "john@example.com", name: "John", role: "MEMBER" },
        { email: "john@example.com", name: "John Duplicate", role: "ADMIN" },
      ];

      const result = validateUserCSV(rows);

      expect(result.valid).toHaveLength(1); // only the first is valid
      expect(result.errors).toHaveLength(1); // the second is a duplicate error
      expect(result.errors[0].message).toContain("Duplicate");
    });

    it("should accept valid roles", async () => {
      const { validateUserCSV } = await import("./csv");
      const validRoles = ["ADMIN", "MEMBER", "VIEWER"];

      validRoles.forEach((role) => {
        const rows = [
          { email: `test-${role}@example.com`, name: "Test", role },
        ];
        const result = validateUserCSV(rows);

        expect(result.valid).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
      });
    });

    it("should accept roles case-insensitively", async () => {
      const { validateUserCSV } = await import("./csv");
      const rows = [
        { email: "john@example.com", name: "John", role: "member" },
        { email: "jane@example.com", name: "Jane", role: "Admin" },
      ];

      const result = validateUserCSV(rows);

      expect(result.valid).toHaveLength(2);
      expect(result.valid[0].role).toBe("MEMBER");
      expect(result.valid[1].role).toBe("ADMIN");
    });

    it("should be valid without optional fields", async () => {
      const { validateUserCSV } = await import("./csv");
      const rows = [{ email: "john@example.com", role: "MEMBER" }];

      const result = validateUserCSV(rows);

      expect(result.valid).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.valid[0].name).toBeUndefined();
      expect(result.valid[0].department).toBeUndefined();
    });
  });
});
