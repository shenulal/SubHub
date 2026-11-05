// src/components/reports/audit/audit-log-table.test.tsx
import messages from "@/i18n/messages/en.json";
import type { AuditLogEntry } from "@/types/audit";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { AuditLogTable } from "./audit-log-table";

describe("AuditLogTable", () => {
  const renderWithIntl = (ui: React.ReactElement) =>
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    );

  const baseLog: AuditLogEntry = {
    id: "log-1",
    action: "CREATE_APP",
    entityType: "App",
    entityId: "app-12345678",
    userId: "user-1",
    userName: "John Smith",
    userEmail: "hong@example.com",
    changes: null,
    metadata: { appName: "Slack" },
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  it("shows the same text on the action badge as the filter label (Create)", () => {
    renderWithIntl(<AuditLogTable logs={[baseLog]} onViewDetail={() => {}} />);

    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("shows the entity type label together with a human-readable name in the entity column", () => {
    renderWithIntl(<AuditLogTable logs={[baseLog]} onViewDetail={() => {}} />);

    // Entity type label (App)
    expect(screen.getByText("App")).toBeInTheDocument();
    // Uses metadata.appName
    expect(screen.getByText("Slack")).toBeInTheDocument();
  });
});
