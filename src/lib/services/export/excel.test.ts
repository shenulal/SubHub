// src/lib/services/export/excel.test.ts
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  addWorksheetToWorkbook,
  generateExcelWorkbook,
  type ExcelColumn,
  type ExcelSheetConfig,
} from "./excel";

describe("Excel Export Service", () => {
  describe("generateExcelWorkbook", () => {
    const columns: ExcelColumn[] = [
      { key: "name", header: "Name", width: 20 },
      { key: "email", header: "Email", width: 30 },
      {
        key: "amount",
        header: "Amount",
        width: 15,
        style: { numFmt: "#,##0" },
      },
    ];

    const data = [
      { name: "Ahmed Ali", email: "hong@example.com", amount: 10000 },
      { name: "Fatima Hassan", email: "kim@example.com", amount: 20000 },
    ];

    it("creates a workbook", async () => {
      const workbook = await generateExcelWorkbook({
        sheetName: "Test",
        columns,
        data,
      });

      expect(workbook).toBeInstanceOf(ExcelJS.Workbook);
    });

    it("creates a worksheet with the given sheet name", async () => {
      const workbook = await generateExcelWorkbook({
        sheetName: "Cost Report",
        columns,
        data,
      });

      const worksheet = workbook.getWorksheet("Cost Report");
      expect(worksheet).toBeDefined();
    });

    it("includes the header row", async () => {
      const workbook = await generateExcelWorkbook({
        sheetName: "Test",
        columns,
        data,
      });

      const worksheet = workbook.getWorksheet("Test");
      const headerRow = worksheet?.getRow(1);

      expect(headerRow?.getCell(1).value).toBe("Name");
      expect(headerRow?.getCell(2).value).toBe("Email");
      expect(headerRow?.getCell(3).value).toBe("Amount");
    });

    it("includes the data rows", async () => {
      const workbook = await generateExcelWorkbook({
        sheetName: "Test",
        columns,
        data,
      });

      const worksheet = workbook.getWorksheet("Test");
      const dataRow1 = worksheet?.getRow(2);
      const dataRow2 = worksheet?.getRow(3);

      expect(dataRow1?.getCell(1).value).toBe("Ahmed Ali");
      expect(dataRow1?.getCell(2).value).toBe("hong@example.com");
      expect(dataRow2?.getCell(1).value).toBe("Fatima Hassan");
    });

    it("sets column widths", async () => {
      const workbook = await generateExcelWorkbook({
        sheetName: "Test",
        columns,
        data,
      });

      const worksheet = workbook.getWorksheet("Test");
      expect(worksheet?.getColumn(1).width).toBe(20);
      expect(worksheet?.getColumn(2).width).toBe(30);
    });

    it("includes only the header for empty data", async () => {
      const workbook = await generateExcelWorkbook({
        sheetName: "Test",
        columns,
        data: [],
      });

      const worksheet = workbook.getWorksheet("Test");
      expect(worksheet?.rowCount).toBe(1);
    });

    it("can include a title", async () => {
      const workbook = await generateExcelWorkbook({
        sheetName: "Test",
        columns,
        data,
        title: "Monthly Cost Report",
      });

      const worksheet = workbook.getWorksheet("Test");
      const titleRow = worksheet?.getRow(1);
      expect(titleRow?.getCell(1).value).toBe("Monthly Cost Report");
    });
  });

  describe("addWorksheetToWorkbook", () => {
    it("adds a new worksheet to an existing workbook", async () => {
      const workbook = new ExcelJS.Workbook();

      const config1: ExcelSheetConfig = {
        sheetName: "Sheet1",
        columns: [{ key: "name", header: "Name" }],
        data: [{ name: "Test1" }],
      };

      const config2: ExcelSheetConfig = {
        sheetName: "Sheet2",
        columns: [{ key: "name", header: "Name" }],
        data: [{ name: "Test2" }],
      };

      addWorksheetToWorkbook(workbook, config1);
      addWorksheetToWorkbook(workbook, config2);

      expect(workbook.worksheets.length).toBe(2);
      expect(workbook.getWorksheet("Sheet1")).toBeDefined();
      expect(workbook.getWorksheet("Sheet2")).toBeDefined();
    });
  });
});
