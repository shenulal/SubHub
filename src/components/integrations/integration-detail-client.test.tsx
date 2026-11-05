import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntegrationDetailClient } from "./integration-detail-client";

const mockUseShow = vi.fn();
const fetchSpy = vi.fn();
const mockRouter = { push: vi.fn(), back: vi.fn() };

vi.stubGlobal("fetch", fetchSpy);

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("@/actions/integrations", () => ({
  deleteIntegration: vi.fn(),
  getSyncLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock("@refinedev/core", () => ({
  useShow: (...args: unknown[]) => mockUseShow(...args),
}));

vi.mock("@/components/integrations/integration-detail-card", () => ({
  IntegrationDetailCard: ({ integration }: { integration: { id: string } }) => (
    <div data-testid="detail-card">{integration.id}</div>
  ),
}));

vi.mock("@/components/integrations/integration-settings-form", () => ({
  IntegrationSettingsForm: ({ integrationId }: { integrationId: string }) => (
    <div data-testid="settings-form">{integrationId}</div>
  ),
}));

vi.mock("@/components/integrations/sync-logs-table", () => ({
  SyncLogsTable: ({ logs }: { logs: unknown[] }) => (
    <div data-testid="sync-logs">{logs.length}</div>
  ),
}));

describe("IntegrationDetailClient", () => {
  it("shows the loading state", async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ logs: [] }) });
    mockUseShow.mockReturnValue({
      query: { data: undefined, isLoading: true },
    });

    await act(async () => {
      render(<IntegrationDetailClient id="int-1" canManage />);
    });

    expect(screen.getByText(/Loading integration/)).toBeInTheDocument();
  });

  it("shows a notice when there is no data", async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ logs: [] }) });
    mockUseShow.mockReturnValue({
      query: { data: undefined, isLoading: false },
    });

    await act(async () => {
      render(<IntegrationDetailClient id="int-1" canManage />);
    });

    expect(screen.getByText(/Integration not found/)).toBeInTheDocument();
  });

  it("renders the detail, settings and log components", async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ logs: [] }) });
    mockUseShow.mockReturnValue({
      query: {
        data: {
          data: {
            id: "int-1",
            metadata: {},
            type: "GOOGLE_WORKSPACE",
            status: "ACTIVE",
            lastSyncAt: null,
            lastError: null,
            syncCount: 0,
            createdAt: "",
            updatedAt: "",
          },
        },
        isLoading: false,
      },
    });

    await act(async () => {
      render(<IntegrationDetailClient id="int-1" canManage />);
    });

    expect(screen.getByTestId("detail-card")).toHaveTextContent("int-1");
    expect(screen.getByTestId("settings-form")).toHaveTextContent("int-1");
    expect(screen.getByTestId("sync-logs")).toBeInTheDocument();
  });
});
