// src/components/integrations/integration-settings-form.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationSettingsForm } from "./integration-settings-form";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

// Mock Server Actions
const mockUpdateIntegrationSettings = vi.fn();
vi.mock("@/actions/integrations", () => ({
  updateIntegrationSettings: (...args: unknown[]) =>
    mockUpdateIntegrationSettings(...args),
}));

describe("IntegrationSettingsForm", () => {
  const defaultProps = {
    integrationId: "int-1",
    initialSettings: {
      autoSync: true,
      syncInterval: "daily" as const,
      syncUsers: true,
      syncApps: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render form fields", () => {
    render(<IntegrationSettingsForm {...defaultProps} />);

    expect(screen.getByText("Auto sync")).toBeInTheDocument();
    expect(screen.getByText("Sync interval")).toBeInTheDocument();
    expect(screen.getByText("Sync users")).toBeInTheDocument();
    expect(screen.getByText("Sync apps")).toBeInTheDocument();
  });

  it("should render initial values", () => {
    render(<IntegrationSettingsForm {...defaultProps} />);

    // The auto sync switch should be on
    const autoSyncSwitch = screen.getByRole("switch", { name: /Auto sync/i });
    expect(autoSyncSwitch).toBeChecked();

    // The sync users switch should be on
    const syncUsersSwitch = screen.getByRole("switch", {
      name: /Sync users/i,
    });
    expect(syncUsersSwitch).toBeChecked();

    // The sync apps switch should be off
    const syncAppsSwitch = screen.getByRole("switch", { name: /Sync apps/i });
    expect(syncAppsSwitch).not.toBeChecked();
  });

  it("should call updateIntegrationSettings on save", async () => {
    mockUpdateIntegrationSettings.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(<IntegrationSettingsForm {...defaultProps} />);

    const saveButton = screen.getByRole("button", { name: /Save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateIntegrationSettings).toHaveBeenCalledWith("int-1", {
        autoSync: true,
        syncInterval: "daily",
        syncUsers: true,
        syncApps: false,
      });
    });
  });

  it("should toggle autoSync setting", async () => {
    mockUpdateIntegrationSettings.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(<IntegrationSettingsForm {...defaultProps} />);

    const autoSyncSwitch = screen.getByRole("switch", { name: /Auto sync/i });
    await user.click(autoSyncSwitch);

    const saveButton = screen.getByRole("button", { name: /Save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateIntegrationSettings).toHaveBeenCalledWith(
        "int-1",
        expect.objectContaining({
          autoSync: false,
        })
      );
    });
  });

  it("should show loading state when saving", async () => {
    mockUpdateIntegrationSettings.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ success: true }), 100)
        )
    );
    const user = userEvent.setup();

    render(<IntegrationSettingsForm {...defaultProps} />);

    const saveButton = screen.getByRole("button", { name: /Save/i });
    await user.click(saveButton);

    expect(screen.getByText(/Saving/i)).toBeInTheDocument();
  });

  it("should render disabled state when disabled prop is true", () => {
    render(<IntegrationSettingsForm {...defaultProps} disabled />);

    const saveButton = screen.getByRole("button", { name: /Save/i });
    expect(saveButton).toBeDisabled();
  });
});
