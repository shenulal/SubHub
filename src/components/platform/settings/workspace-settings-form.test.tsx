import { SECRET_UNCHANGED, type SettingsGroupPayload } from "@/types/platform";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSettingsForm } from "./workspace-settings-form";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix Switch measures itself with ResizeObserver; the global setup stub is
// not constructible under vitest 4, so provide a real class here.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

const payload: SettingsGroupPayload = {
  group: "finance",
  label: "Finance & currency",
  description: "Base currency and budgets",
  definitions: [
    {
      key: "finance.baseCurrency",
      group: "finance",
      scope: "organization",
      label: "Base currency",
      input: "select",
      options: [
        { value: "AED", label: "AED" },
        { value: "USD", label: "USD" },
      ],
      defaultValue: "AED",
      value: "AED",
      isOverridden: false,
    },
    {
      key: "finance.pricesIncludeTax",
      group: "finance",
      scope: "organization",
      label: "Prices include tax",
      input: "boolean",
      defaultValue: false,
      value: false,
      isOverridden: true,
      description: "Whether amounts include VAT",
    },
    {
      key: "finance.roundingDecimals",
      group: "finance",
      scope: "organization",
      label: "Rounding",
      input: "number",
      min: 0,
      max: 4,
      defaultValue: 2,
      value: 2,
      isOverridden: false,
    },
    {
      key: "finance.fxApiKey",
      group: "finance",
      scope: "organization",
      label: "API key",
      input: "secret",
      sensitive: true,
      defaultValue: "",
      value: "••••1234",
      isOverridden: true,
    },
  ],
};

describe("WorkspaceSettingsForm", () => {
  const saveAction = vi.fn();
  const resetAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    saveAction.mockResolvedValue({
      success: true,
      data: { updatedKeys: ["finance.pricesIncludeTax"] },
    });
    resetAction.mockResolvedValue({ success: true, data: { value: false } });
  });

  it("renders every definition and disables saving until something changes", () => {
    render(
      <WorkspaceSettingsForm
        payload={payload}
        canManage
        saveAction={saveAction}
        resetAction={resetAction}
      />
    );
    expect(screen.getByText("Base currency")).toBeInTheDocument();
    expect(screen.getByLabelText("Prices include tax")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save changes/ })).toBeDisabled();
  });

  it("submits only the dirty keys and never sends untouched secrets", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceSettingsForm
        payload={payload}
        canManage
        saveAction={saveAction}
        resetAction={resetAction}
      />
    );
    await user.click(screen.getByLabelText("Prices include tax"));
    await user.clear(screen.getByLabelText("Rounding"));
    await user.type(screen.getByLabelText("Rounding"), "3");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
    expect(saveAction).toHaveBeenCalledWith("finance", {
      "finance.pricesIncludeTax": true,
      "finance.roundingDecimals": 3,
    });
    expect(JSON.stringify(saveAction.mock.calls[0][1])).not.toContain(
      SECRET_UNCHANGED
    );
  });

  it("shows field errors returned by the action", async () => {
    saveAction.mockResolvedValue({
      success: false,
      error: "Validation failed",
      errors: { "finance.roundingDecimals": ["Too big for this plan"] },
    });
    const user = userEvent.setup();
    render(
      <WorkspaceSettingsForm
        payload={payload}
        canManage
        saveAction={saveAction}
        resetAction={resetAction}
      />
    );
    await user.clear(screen.getByLabelText("Rounding"));
    await user.type(screen.getByLabelText("Rounding"), "4");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("Too big for this plan", {}, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  it("hides the save bar for read-only members", () => {
    render(
      <WorkspaceSettingsForm
        payload={payload}
        canManage={false}
        saveAction={saveAction}
        resetAction={resetAction}
      />
    );
    expect(screen.queryByRole("button", { name: /Save changes/ })).toBeNull();
    expect(screen.getByLabelText("Prices include tax")).toBeDisabled();
  });
});
