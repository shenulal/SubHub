// src/components/integrations/sync-logs-table.test.tsx
import type { SyncLogEntry } from "@/actions/integrations";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SyncLogsTable } from "./sync-logs-table";

describe("SyncLogsTable", () => {
  const mockLogs: SyncLogEntry[] = [
    {
      id: "log-1",
      status: "SUCCESS",
      itemsFound: 10,
      itemsCreated: 2,
      itemsUpdated: 8,
      errors: null,
      startedAt: "2024-11-30T10:00:00Z",
      completedAt: "2024-11-30T10:05:00Z",
    },
    {
      id: "log-2",
      status: "PARTIAL",
      itemsFound: 5,
      itemsCreated: 1,
      itemsUpdated: 3,
      errors: [{ code: "USER_ERROR", message: "Some users failed to sync" }],
      startedAt: "2024-11-29T10:00:00Z",
      completedAt: "2024-11-29T10:03:00Z",
    },
    {
      id: "log-3",
      status: "FAILED",
      itemsFound: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errors: [{ code: "AUTH_ERROR", message: "Authentication failed" }],
      startedAt: "2024-11-28T10:00:00Z",
      completedAt: "2024-11-28T10:00:30Z",
    },
  ];

  it("should render table headers", () => {
    render(<SyncLogsTable logs={mockLogs} />);

    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Found")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
  });

  it("should render log entries", () => {
    render(<SyncLogsTable logs={mockLogs} />);

    // Stats for the first log
    expect(screen.getByText("10")).toBeInTheDocument(); // itemsFound
    expect(screen.getAllByText("2").length).toBeGreaterThan(0); // itemsCreated
    expect(screen.getByText("8")).toBeInTheDocument(); // itemsUpdated
  });

  it("should render success status badge", () => {
    render(<SyncLogsTable logs={mockLogs} />);
    expect(screen.getByText("Success")).toBeInTheDocument();
  });

  it("should render partial status badge", () => {
    render(<SyncLogsTable logs={mockLogs} />);
    expect(screen.getByText("Partial success")).toBeInTheDocument();
  });

  it("should render failed status badge", () => {
    render(<SyncLogsTable logs={mockLogs} />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("should render empty state when no logs", () => {
    render(<SyncLogsTable logs={[]} />);
    expect(screen.getByText(/No sync logs/)).toBeInTheDocument();
  });

  it("should format duration correctly", () => {
    render(<SyncLogsTable logs={mockLogs} />);
    // 5 minutes = 300 seconds
    expect(screen.getByText("5m 0s")).toBeInTheDocument();
  });

  it("should show error indicator for logs with errors", () => {
    render(<SyncLogsTable logs={mockLogs} />);
    // Logs with errors show an error icon
    const errorIcons = screen.getAllByTestId("error-indicator");
    expect(errorIcons.length).toBeGreaterThanOrEqual(2);
  });
});
