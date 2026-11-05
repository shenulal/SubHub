// src/components/reports/audit/audit-log-detail-dialog.test.tsx
import messages from "@/i18n/messages/en.json";
import type { AuditLogEntry } from "@/types/audit";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { AuditLogDetailDialog } from "./audit-log-detail-dialog";

describe("AuditLogDetailDialog", () => {
  const renderWithIntl = (ui: React.ReactElement) =>
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    );

  const baseLog: AuditLogEntry = {
    id: "log-1",
    action: "CREATE_SUBSCRIPTION",
    entityType: "Subscription",
    entityId: "sub-12345678",
    userId: "user-1",
    userName: "Administrator",
    userEmail: "admin@example.com",
    changes: null,
    metadata: { appName: "Slack", amount: 10000 },
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  it("shows the Create label on the action badge", () => {
    renderWithIntl(
      <AuditLogDetailDialog log={baseLog} open onOpenChange={() => {}} />
    );

    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("shows a human-readable name in the entity name section", () => {
    renderWithIntl(
      <AuditLogDetailDialog log={baseLog} open onOpenChange={() => {}} />
    );

    // Field label
    expect(screen.getByText("Entity name")).toBeInTheDocument();
    // Display name derived from metadata
    expect(screen.getByText(/Slack/)).toBeInTheDocument();
  });
});
