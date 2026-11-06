// src/lib/services/report/email-sender.ts
/**
 * Report e-mail delivery service
 */

import { prisma } from "@/lib/db";
import { DEFAULT_BASE_CURRENCY, formatMoney } from "@/lib/fx/convert";
import { generateCSV } from "@/lib/services/export/csv";
import {
  generateExcelWorkbook,
  workbookToBuffer,
} from "@/lib/services/export/excel";
import { generatePDFReport, type PDFSection } from "@/lib/services/export/pdf";
import { Resend } from "resend";

// Lazy initialization to avoid build-time errors when API key is not set
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY || "dummy-key-for-build";
    resend = new Resend(apiKey);
  }
  return resend;
}

interface SendReportEmailParams {
  scheduleId: string;
  organizationId: string;
  organizationName: string;
  reportType: string;
  format: string;
  recipients: string[];
}

export async function sendReportEmail(
  params: SendReportEmailParams
): Promise<void> {
  const { organizationId, organizationName, reportType, format, recipients } =
    params;

  // Build report data
  const reportData = await generateReportData(organizationId, reportType);

  // Generate the report file
  const { buffer, filename, mimeType } = await generateReportFile(
    reportData,
    reportType,
    format,
    organizationName
  );

  // Send the e-mail
  const reportTypeLabels: Record<string, string> = {
    COST_ANALYSIS: "Cost Analysis",
    RENEWAL: "Subscription Renewal",
    TERMINATED_USERS: "Offboarded Users",
  };

  const reportLabel = reportTypeLabels[reportType] || reportType;

  await getResendClient().emails.send({
    from: "SubHub <reports@resend.dev>",
    to: recipients,
    subject: `[${organizationName}] ${reportLabel} Report - ${new Date().toLocaleDateString("en-US")}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">📊 ${reportLabel} Report</h2>
        <p>Hello,</p>
        <p>The ${reportLabel} report for ${organizationName} has been generated.</p>
        <p>Please find the report attached.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        <p style="color: #666; font-size: 12px;">
          This is an automated message from SubHub.
        </p>
      </div>
    `,
    attachments: [
      {
        filename,
        content: Buffer.from(buffer).toString("base64"),
        contentType: mimeType,
      },
    ],
  });
}

interface ReportData {
  type: string;
  data: unknown;
  generatedAt: Date;
}

async function generateReportData(
  organizationId: string,
  reportType: string
): Promise<ReportData> {
  const generatedAt = new Date();

  switch (reportType) {
    case "COST_ANALYSIS": {
      // Cost analysis data
      const payments = await prisma.paymentRecord.findMany({
        where: {
          organizationId,
          matchStatus: { in: ["MANUAL", "AUTO_MATCHED"] },
        },
        include: {
          matchedApp: { select: { name: true } },
        },
        orderBy: { transactionDate: "desc" },
        take: 100,
      });

      return {
        type: reportType,
        data: payments.map((p) => ({
          date: p.transactionDate,
          description: p.merchantName,
          amount: Number(p.amount),
          currency: p.currency,
          appName: p.matchedApp?.name || "Unmatched",
        })),
        generatedAt,
      };
    }

    case "RENEWAL": {
      // Subscription renewal data
      const now = new Date();
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

      const subscriptions = await prisma.subscription.findMany({
        where: {
          organizationId,
          status: "ACTIVE",
          renewalDate: { gte: now, lte: ninetyDaysFromNow },
        },
        include: {
          app: { select: { name: true } },
        },
        orderBy: { renewalDate: "asc" },
      });

      return {
        type: reportType,
        data: subscriptions.map((s) => ({
          appName: s.app.name,
          renewalDate: s.renewalDate,
          amount: Number(s.amount),
          currency: s.currency,
          daysUntilRenewal: Math.ceil(
            (s.renewalDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          ),
        })),
        generatedAt,
      };
    }

    case "TERMINATED_USERS": {
      // Offboarded users data
      const terminatedUsers = await prisma.user.findMany({
        where: {
          organizationId,
          status: "TERMINATED",
          appAccesses: { some: {} },
        },
        include: {
          _count: { select: { appAccesses: true } },
          appAccesses: {
            include: {
              app: { select: { name: true } },
            },
          },
        },
        orderBy: { terminatedAt: "desc" },
      });

      return {
        type: reportType,
        data: terminatedUsers.map((u) => ({
          name: u.name || u.email,
          email: u.email,
          department: u.department,
          terminatedAt: u.terminatedAt,
          unrevokedAccessCount: u._count.appAccesses,
          apps: u.appAccesses.map((a) => a.app.name).join(", "),
        })),
        generatedAt,
      };
    }

    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

async function generateReportFile(
  reportData: ReportData,
  reportType: string,
  format: string,
  organizationName: string
): Promise<{ buffer: ArrayBuffer; filename: string; mimeType: string }> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const reportTypeLabels: Record<string, string> = {
    COST_ANALYSIS: "cost-analysis",
    RENEWAL: "renewal",
    TERMINATED_USERS: "terminated-users",
  };
  const typeLabel = reportTypeLabels[reportType] || reportType.toLowerCase();

  switch (format) {
    case "PDF": {
      const sections = generatePDFSections(reportData);
      const buffer = await generatePDFReport({
        title: getReportTitle(reportType),
        subtitle: `Generated: ${new Date().toLocaleDateString("en-US")}`,
        organizationName,
        generatedAt: reportData.generatedAt,
        sections,
      });
      return {
        buffer,
        filename: `${typeLabel}-report-${dateStr}.pdf`,
        mimeType: "application/pdf",
      };
    }

    case "EXCEL": {
      const workbook = await generateExcelWorkbook({
        sheetName: getReportTitle(reportType),
        columns: getExcelColumns(reportType),
        data: reportData.data as Record<string, unknown>[],
        title: `${getReportTitle(reportType)} - ${organizationName}`,
      });
      const excelBuffer = await workbookToBuffer(workbook);
      return {
        buffer: excelBuffer,
        filename: `${typeLabel}-report-${dateStr}.xlsx`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }

    case "CSV": {
      const csv = generateCSV(
        getCSVColumns(reportType),
        reportData.data as Record<string, unknown>[],
        { includeBOM: true }
      );
      const encoder = new TextEncoder();
      const buffer = encoder.encode(csv).buffer as ArrayBuffer;
      return {
        buffer,
        filename: `${typeLabel}-report-${dateStr}.csv`,
        mimeType: "text/csv;charset=utf-8",
      };
    }

    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

function getReportTitle(reportType: string): string {
  const titles: Record<string, string> = {
    COST_ANALYSIS: "Cost Analysis Report",
    RENEWAL: "Subscription Renewal Report",
    TERMINATED_USERS: "Offboarded Users Report",
  };
  return titles[reportType] || "Report";
}

function generatePDFSections(reportData: ReportData): PDFSection[] {
  const data = reportData.data as Record<string, unknown>[];

  switch (reportData.type) {
    case "COST_ANALYSIS":
      return [
        {
          type: "table",
          title: "Payment History",
          headers: ["Date", "Description", "Amount", "App"],
          rows: data
            .slice(0, 50)
            .map((d) => [
              new Date(d.date as Date).toLocaleDateString("en-US"),
              (d.description as string) || "-",
              formatMoney(
                d.amount as number,
                (d.currency as string) || DEFAULT_BASE_CURRENCY,
                "en-US"
              ),
              (d.appName as string) || "-",
            ]),
        },
      ];

    case "RENEWAL":
      return [
        {
          type: "table",
          title: "Upcoming Renewals",
          headers: ["App Name", "Renewal Date", "Amount", "D-Day"],
          rows: data.map((d) => [
            d.appName as string,
            new Date(d.renewalDate as Date).toLocaleDateString("en-US"),
            `${d.currency}${(d.amount as number).toLocaleString()}`,
            `D-${d.daysUntilRenewal}`,
          ]),
        },
      ];

    case "TERMINATED_USERS":
      return [
        {
          type: "table",
          title: "Offboarded Users with Unrevoked Access",
          headers: ["Name", "Department", "Offboarding Date", "Unrevoked Apps"],
          rows: data.map((d) => [
            d.name as string,
            (d.department as string) || "-",
            d.terminatedAt
              ? new Date(d.terminatedAt as Date).toLocaleDateString("en-US")
              : "-",
            `${d.unrevokedAccessCount}`,
          ]),
        },
      ];

    default:
      return [];
  }
}

function getExcelColumns(reportType: string) {
  switch (reportType) {
    case "COST_ANALYSIS":
      return [
        { key: "date", header: "Date", width: 15 },
        { key: "description", header: "Description", width: 30 },
        { key: "amount", header: "Amount", width: 15 },
        { key: "appName", header: "App", width: 20 },
      ];
    case "RENEWAL":
      return [
        { key: "appName", header: "App Name", width: 20 },
        { key: "renewalDate", header: "Renewal Date", width: 15 },
        { key: "amount", header: "Amount", width: 15 },
        { key: "daysUntilRenewal", header: "Days Remaining", width: 12 },
      ];
    case "TERMINATED_USERS":
      return [
        { key: "name", header: "Name", width: 15 },
        { key: "email", header: "Email", width: 25 },
        { key: "department", header: "Department", width: 15 },
        { key: "terminatedAt", header: "Offboarding Date", width: 15 },
        { key: "unrevokedAccessCount", header: "Unrevoked Apps", width: 12 },
        { key: "apps", header: "Apps", width: 40 },
      ];
    default:
      return [];
  }
}

function getCSVColumns(reportType: string) {
  return getExcelColumns(reportType);
}
