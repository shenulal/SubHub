// src/components/settings/budget-settings-form.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BudgetSettings, DEFAULT_BUDGET_SETTINGS } from "@/types/budget";
import { BudgetSettingsForm } from "./budget-settings-form";

// Mock server action
vi.mock("@/actions/budget-settings", () => ({
  updateBudgetSettings: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { updateBudgetSettings } from "@/actions/budget-settings";
import { toast } from "sonner";

describe("BudgetSettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render with default settings", () => {
    render(<BudgetSettingsForm initialSettings={DEFAULT_BUDGET_SETTINGS} />);

    // Currency selection
    expect(screen.getByText("Currency")).toBeInTheDocument();

    // Auto-set toggle
    expect(
      screen.getByText("Auto set from last month spend")
    ).toBeInTheDocument();

    // Save button
    expect(screen.getByRole("button", { name: /Save/i })).toBeInTheDocument();
  });

  it("should render with custom settings", () => {
    const customSettings: BudgetSettings = {
      currency: "USD",
      monthlyBudget: 5000,
      alertThreshold: 90,
    };

    render(<BudgetSettingsForm initialSettings={customSettings} />);

    // Monthly budget input should be shown (auto mode off)
    expect(screen.getByLabelText(/Monthly budget/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Monthly budget/i)).toHaveValue("5,000");
  });

  it("should toggle auto budget mode", async () => {
    const user = userEvent.setup();

    render(<BudgetSettingsForm initialSettings={DEFAULT_BUDGET_SETTINGS} />);

    // Auto mode is on initially (monthlyBudget: null)
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeChecked();

    // Turning the toggle off reveals the budget input
    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(screen.getByLabelText(/Monthly budget/i)).toBeInTheDocument();
  });

  it("should call updateBudgetSettings on form submit", async () => {
    const user = userEvent.setup();
    vi.mocked(updateBudgetSettings).mockResolvedValue({ success: true });

    const settings: BudgetSettings = {
      currency: "KRW",
      monthlyBudget: 1000000,
      alertThreshold: 80,
    };

    render(<BudgetSettingsForm initialSettings={settings} />);

    const saveButton = screen.getByRole("button", { name: /Save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateBudgetSettings).toHaveBeenCalled();
    });

    expect(toast.success).toHaveBeenCalledWith("Budget settings saved");
  });

  it("should show error toast on update failure", async () => {
    const user = userEvent.setup();
    vi.mocked(updateBudgetSettings).mockResolvedValue({
      success: false,
      message: "Admin permission required",
    });

    render(<BudgetSettingsForm initialSettings={DEFAULT_BUDGET_SETTINGS} />);

    const saveButton = screen.getByRole("button", { name: /Save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Admin permission required");
    });
  });

  it("should format currency input correctly", async () => {
    const user = userEvent.setup();

    const settings: BudgetSettings = {
      currency: "KRW",
      monthlyBudget: 0,
      alertThreshold: 80,
    };

    render(<BudgetSettingsForm initialSettings={settings} />);

    const input = screen.getByLabelText(/Monthly budget/i);

    // Type a number
    await user.clear(input);
    await user.type(input, "1000000");

    // Formatted value (1,000,000)
    expect(input).toHaveValue("1,000,000");
  });

  it("should display current budget status", () => {
    const settings: BudgetSettings = {
      currency: "KRW",
      monthlyBudget: null,
      alertThreshold: 80,
    };

    render(<BudgetSettingsForm initialSettings={settings} />);

    // Auto mode status message
    expect(
      screen.getByText(/Budget is set from last month's card approval total/i)
    ).toBeInTheDocument();
  });
});
