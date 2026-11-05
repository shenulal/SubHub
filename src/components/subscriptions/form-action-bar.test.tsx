// src/components/subscriptions/form-action-bar.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FormActionBar, focusFirstInvalid } from "./form-action-bar";

describe("FormActionBar", () => {
  it("disables both actions and shows progress while pending", () => {
    render(
      <FormActionBar
        cancelLabel="Cancel"
        submitLabel="Save"
        isPending
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("calls cancel and targets an external form by id", async () => {
    const onCancel = vi.fn();
    render(
      <FormActionBar
        cancelLabel="Cancel"
        submitLabel="Save"
        isPending={false}
        onCancel={onCancel}
        formId="f1"
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "form",
      "f1"
    );
  });
});

describe("focusFirstInvalid", () => {
  it("focuses the invalid field that appears first on the page", () => {
    render(
      <div>
        <button id="appName">App</button>
        <input name="amount" aria-label="Amount" />
      </div>
    );
    expect(focusFirstInvalid(["amount", "appName"])).toBe("appName");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "App" })
    );
  });

  it("falls back to the first key when nothing can be located", () => {
    expect(focusFirstInvalid(["missing"])).toBe("missing");
    expect(focusFirstInvalid([])).toBeUndefined();
  });
});
