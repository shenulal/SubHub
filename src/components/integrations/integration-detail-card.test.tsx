// src/components/integrations/integration-detail-card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  IntegrationDetailCard,
  type IntegrationDetailProps,
} from "./integration-detail-card";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

// Mock Server Actions
vi.mock("@/actions/integrations", () => ({
  syncIntegrationNow: vi.fn(),
  updateIntegrationStatus: vi.fn(),
}));

describe("IntegrationDetailCard", () => {
  const mockIntegration: IntegrationDetailProps = {
    id: "int-1",
    type: "GOOGLE_WORKSPACE",
    status: "ACTIVE",
    lastSyncAt: "2024-11-30T10:00:00Z",
    lastError: null,
    syncCount: 5,
    lastSyncResult: {
      status: "SUCCESS",
      itemsFound: 10,
      itemsCreated: 2,
      itemsUpdated: 8,
      errors: [],
    },
    metadata: {
      domain: "example.com",
      autoSync: true,
      syncInterval: "daily" as const,
    },
    createdAt: "2024-11-01T10:00:00Z",
    updatedAt: "2024-11-30T10:00:00Z",
  };

  it("should render integration type name", () => {
    render(<IntegrationDetailCard integration={mockIntegration} />);
    expect(screen.getByText("Google Workspace")).toBeInTheDocument();
  });

  it("should render active status badge", () => {
    render(<IntegrationDetailCard integration={mockIntegration} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("should render pending status badge", () => {
    render(
      <IntegrationDetailCard
        integration={{ ...mockIntegration, status: "PENDING" }}
      />
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("should render error status badge", () => {
    render(
      <IntegrationDetailCard
        integration={{ ...mockIntegration, status: "ERROR" }}
      />
    );
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("should render disconnected status badge", () => {
    render(
      <IntegrationDetailCard
        integration={{ ...mockIntegration, status: "DISCONNECTED" }}
      />
    );
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("should render last sync time", () => {
    render(<IntegrationDetailCard integration={mockIntegration} />);
    // Both "Last sync" and "Last sync result" exist, so use getAllBy
    const syncTexts = screen.getAllByText(/Last sync/);
    expect(syncTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("should render sync statistics", () => {
    render(<IntegrationDetailCard integration={mockIntegration} />);
    expect(screen.getByText("Total sync count")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("should render last sync result when available", () => {
    render(<IntegrationDetailCard integration={mockIntegration} />);
    expect(screen.getByText("Found")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("should render sync button", () => {
    render(<IntegrationDetailCard integration={mockIntegration} />);
    expect(screen.getByRole("button", { name: /Sync/i })).toBeInTheDocument();
  });

  it("disables the sync button without manage permission", () => {
    render(
      <IntegrationDetailCard integration={mockIntegration} canManage={false} />
    );
    expect(screen.getByRole("button", { name: /Sync/i })).toBeDisabled();
  });

  it("should render sync button for non-active integrations", () => {
    render(
      <IntegrationDetailCard
        integration={{ ...mockIntegration, status: "PENDING" }}
      />
    );
    // The component currently shows the sync button in the PENDING state too
    const syncButton = screen.getByRole("button", { name: /Sync/i });
    expect(syncButton).toBeInTheDocument();
  });

  it("should render domain from metadata if available", () => {
    render(<IntegrationDetailCard integration={mockIntegration} />);
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });
});
