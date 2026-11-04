// src/app/(dashboard)/settings/budget/page.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";

class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`Redirect to ${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
}));

import { redirect } from "next/navigation";
import BudgetSettingsPage from "./page";

describe("BudgetSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to the registry-driven finance settings group", () => {
    expect(() => BudgetSettingsPage()).toThrow(
      "Redirect to /settings/workspace/finance"
    );
    expect(redirect).toHaveBeenCalledWith("/settings/workspace/finance");
  });
});
