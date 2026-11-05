// src/lib/services/export/pdf.ts
/**
 * PDF report generation service
 * Generates text-based PDFs with jsPDF
 * Uses jsPDF's built-in Helvetica (Latin) font
 */

import { jsPDF } from "jspdf";

export interface KeyValueItem {
  label: string;
  value: string;
}

export interface TableSection {
  type: "table";
  title: string;
  headers: string[];
  rows: string[][];
}

export interface KeyValueSection {
  type: "keyValue";
  title: string;
  items: KeyValueItem[];
}

export interface TextSection {
  type: "text";
  title: string;
  content: string;
}

export interface ImageSection {
  type: "image";
  title: string;
  imageDataUrl: string;
  width?: number;
  height?: number;
}

export type PDFSection =
  | TableSection
  | KeyValueSection
  | TextSection
  | ImageSection;

export interface PDFReportConfig {
  title: string;
  subtitle?: string;
  organizationName?: string;
  generatedAt?: Date;
  sections: PDFSection[];
}

// Colour constants
const COLORS = {
  primary: [68, 114, 196] as [number, number, number], // #4472C4
  text: [51, 51, 51] as [number, number, number], // #333333
  lightGray: [240, 240, 240] as [number, number, number],
  gray: [128, 128, 128] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

// Margin and size constants
const MARGIN = 20;
const LINE_HEIGHT = 7;

/**
 * Generates the PDF report
 */
export async function generatePDFReport(
  config: PDFReportConfig
): Promise<ArrayBuffer> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  doc.setFont("helvetica", "normal");

  let yPosition = MARGIN;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN * 2;

  // Header section
  yPosition = addHeader(doc, config, yPosition, contentWidth);

  // Add each section
  for (const section of config.sections) {
    // Check for a page break
    if (yPosition > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      yPosition = MARGIN;
    }

    switch (section.type) {
      case "table":
        yPosition = addTableSection(doc, section, yPosition, contentWidth);
        break;
      case "keyValue":
        yPosition = addKeyValueSection(doc, section, yPosition);
        break;
      case "text":
        yPosition = addTextSection(doc, section, yPosition, contentWidth);
        break;
      case "image":
        yPosition = addImageSection(doc, section, yPosition, contentWidth);
        break;
    }

    yPosition += 10; // Spacing between sections
  }

  // Add the footer
  addFooter(doc);

  return doc.output("arraybuffer");
}

/**
 * Adds an image section
 */
function addImageSection(
  doc: jsPDF,
  section: ImageSection,
  yPosition: number,
  contentWidth: number
): number {
  yPosition = addSectionTitle(doc, section.title, yPosition);

  const pageHeight = doc.internal.pageSize.getHeight();
  const imageWidth = section.width ?? contentWidth;
  const imageHeight = section.height ?? Math.round(imageWidth * 0.6);

  if (yPosition + imageHeight > pageHeight - 20) {
    doc.addPage();
    yPosition = MARGIN;
  }

  const format = section.imageDataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
  doc.addImage(
    section.imageDataUrl,
    format,
    MARGIN,
    yPosition,
    imageWidth,
    imageHeight
  );

  return yPosition + imageHeight;
}

/**
 * Adds the header
 */
function addHeader(
  doc: jsPDF,
  config: PDFReportConfig,
  yPosition: number,
  contentWidth: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Organization name
  if (config.organizationName) {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.gray);
    doc.text(config.organizationName, MARGIN, yPosition);
    yPosition += LINE_HEIGHT;
  }

  // Main title
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.primary);
  doc.text(config.title, MARGIN, yPosition + 5);
  yPosition += 15;

  // Subtitle
  if (config.subtitle) {
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.gray);
    doc.text(config.subtitle, MARGIN, yPosition);
    yPosition += LINE_HEIGHT;
  }

  // Generation date
  const generatedAt = config.generatedAt || new Date();
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  const dateText = `Generated: ${formatDate(generatedAt)}`;
  doc.text(dateText, pageWidth - MARGIN - doc.getTextWidth(dateText), MARGIN);

  // Header line
  yPosition += 5;
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, yPosition, MARGIN + contentWidth, yPosition);

  return yPosition + 10;
}

/**
 * Adds a table section
 */
function addTableSection(
  doc: jsPDF,
  section: TableSection,
  yPosition: number,
  contentWidth: number
): number {
  // Section title
  yPosition = addSectionTitle(doc, section.title, yPosition);

  const colCount = section.headers.length;
  const colWidth = contentWidth / colCount;
  const rowHeight = 8;

  // Header background
  doc.setFillColor(...COLORS.primary);
  doc.rect(MARGIN, yPosition, contentWidth, rowHeight, "F");

  // Header text
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  section.headers.forEach((header, index) => {
    doc.text(header, MARGIN + colWidth * index + 2, yPosition + 5.5);
  });

  yPosition += rowHeight;

  // Data rows
  doc.setTextColor(...COLORS.text);
  section.rows.forEach((row, rowIndex) => {
    // Even-row background
    if (rowIndex % 2 === 0) {
      doc.setFillColor(...COLORS.lightGray);
      doc.rect(MARGIN, yPosition, contentWidth, rowHeight, "F");
    }

    row.forEach((cell, cellIndex) => {
      // Truncate long text
      const maxWidth = colWidth - 4;
      let displayText = cell;
      while (
        doc.getTextWidth(displayText) > maxWidth &&
        displayText.length > 0
      ) {
        displayText = displayText.slice(0, -1);
      }
      if (displayText.length < cell.length) {
        displayText = displayText.slice(0, -2) + "...";
      }

      doc.text(displayText, MARGIN + colWidth * cellIndex + 2, yPosition + 5.5);
    });

    yPosition += rowHeight;

    // Check for a page break
    if (yPosition > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      yPosition = MARGIN;
    }
  });

  return yPosition;
}

/**
 * Adds a key-value section
 */
function addKeyValueSection(
  doc: jsPDF,
  section: KeyValueSection,
  yPosition: number
): number {
  // Section title
  yPosition = addSectionTitle(doc, section.title, yPosition);

  doc.setFontSize(11);

  section.items.forEach((item) => {
    // Label
    doc.setTextColor(...COLORS.gray);
    doc.text(item.label + ":", MARGIN, yPosition);

    // Value
    doc.setTextColor(...COLORS.text);
    doc.text(item.value, MARGIN + 60, yPosition);

    yPosition += LINE_HEIGHT;
  });

  return yPosition;
}

/**
 * Adds a text section
 */
function addTextSection(
  doc: jsPDF,
  section: TextSection,
  yPosition: number,
  contentWidth: number
): number {
  // Section title
  yPosition = addSectionTitle(doc, section.title, yPosition);

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);

  // Wrap text
  const lines = doc.splitTextToSize(section.content, contentWidth);
  lines.forEach((line: string) => {
    doc.text(line, MARGIN, yPosition);
    yPosition += LINE_HEIGHT - 1;
  });

  return yPosition;
}

/**
 * Adds a section title
 */
function addSectionTitle(doc: jsPDF, title: string, yPosition: number): number {
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary);
  doc.text(title, MARGIN, yPosition);
  return yPosition + LINE_HEIGHT + 2;
}

/**
 * Adds the footer
 */
function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Page number
    const pageText = `Page ${i} of ${pageCount}`;
    doc.text(
      pageText,
      pageWidth - MARGIN - doc.getTextWidth(pageText),
      pageHeight - 10
    );

    // Footer line
    doc.setDrawColor(...COLORS.lightGray);
    doc.line(MARGIN, pageHeight - 15, pageWidth - MARGIN, pageHeight - 15);

    // Generator information
    doc.text("SubHub", MARGIN, pageHeight - 10);
  }
}

/**
 * Formats a date
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Creates a PDF Blob (for download)
 */
export function createPDFBlob(buffer: ArrayBuffer): Blob {
  return new Blob([buffer], { type: "application/pdf" });
}

/**
 * Triggers a PDF download (client side)
 */
export function downloadPDF(buffer: ArrayBuffer, filename: string): void {
  const blob = createPDFBlob(buffer);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
