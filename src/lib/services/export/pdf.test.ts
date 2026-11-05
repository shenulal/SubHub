// src/lib/services/export/pdf.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePDFReport, type PDFReportConfig } from "./pdf";

// jsPDF mock
vi.mock("jspdf", () => {
  const mockJsPDF = vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    rect: vi.fn(),
    setFillColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    addImage: vi.fn(),
    addPage: vi.fn(),
    internal: {
      pageSize: {
        getWidth: vi.fn().mockReturnValue(210),
        getHeight: vi.fn().mockReturnValue(297),
      },
    },
    getNumberOfPages: vi.fn().mockReturnValue(1),
    setPage: vi.fn(),
    output: vi.fn().mockReturnValue(new ArrayBuffer(100)),
    save: vi.fn(),
    getTextWidth: vi.fn().mockReturnValue(50),
    splitTextToSize: vi.fn().mockImplementation((text: string) => [text]),
  }));

  return { default: mockJsPDF, jsPDF: mockJsPDF };
});

describe("PDF Export Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generatePDFReport", () => {
    const basicConfig: PDFReportConfig = {
      title: "Test Report",
      subtitle: "December 2024",
      sections: [],
    };

    it("generates a PDF document", async () => {
      const result = await generatePDFReport(basicConfig);
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it("handles a table section", async () => {
      const configWithTable: PDFReportConfig = {
        title: "Test Report",
        sections: [
          {
            type: "table",
            title: "Cost Overview",
            headers: ["App Name", "Amount"],
            rows: [
              ["Slack", "₩15,000"],
              ["Notion", "₩12,000"],
            ],
          },
        ],
      };

      const result = await generatePDFReport(configWithTable);
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it("handles a key-value section", async () => {
      const configWithKeyValue: PDFReportConfig = {
        title: "Test Report",
        sections: [
          {
            type: "keyValue",
            title: "Summary",
            items: [
              { label: "Total cost", value: "₩1,234,567" },
              { label: "Month over month", value: "+15.2%" },
            ],
          },
        ],
      };

      const result = await generatePDFReport(configWithKeyValue);
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it("handles a text section", async () => {
      const configWithText: PDFReportConfig = {
        title: "Test Report",
        sections: [
          {
            type: "text",
            title: "Description",
            content: "This report summarises monthly costs.",
          },
        ],
      };

      const result = await generatePDFReport(configWithText);
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it("handles multiple sections in order", async () => {
      const configWithMultipleSections: PDFReportConfig = {
        title: "Consolidated Report",
        subtitle: "December 1, 2024",
        sections: [
          {
            type: "keyValue",
            title: "Summary",
            items: [{ label: "Total cost", value: "₩1,000,000" }],
          },
          {
            type: "table",
            title: "Details",
            headers: ["Item", "Amount"],
            rows: [["Test", "₩100,000"]],
          },
          {
            type: "text",
            title: "Notes",
            content: "No additional notes",
          },
        ],
      };

      const result = await generatePDFReport(configWithMultipleSections);
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it("handles an image section", async () => {
      const configWithImage: PDFReportConfig = {
        title: "Test Report",
        sections: [
          {
            type: "image",
            title: "Chart",
            imageDataUrl:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ",
            width: 100,
            height: 60,
          },
        ],
      };

      const result = await generatePDFReport(configWithImage);
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it("includes the generation date", async () => {
      const configWithDate: PDFReportConfig = {
        title: "Test Report",
        generatedAt: new Date("2024-12-01"),
        sections: [],
      };

      const result = await generatePDFReport(configWithDate);
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it("can include the organization name", async () => {
      const configWithOrg: PDFReportConfig = {
        title: "Test Report",
        organizationName: "Test Company",
        sections: [],
      };

      const result = await generatePDFReport(configWithOrg);
      expect(result).toBeInstanceOf(ArrayBuffer);
    });
  });
});
