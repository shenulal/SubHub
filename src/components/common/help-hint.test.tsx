// src/components/common/help-hint.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { HelpHint } from "./help-hint";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("HelpHint", () => {
  beforeAll(() => {
    // vitest.setup mocks ResizeObserver with vi.fn(), which Radix popper cannot `new`
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  it("opens a popover with title, content and learn-more link", async () => {
    render(
      <HelpHint
        title="Lead days"
        content="Days before renewal."
        href="/docs/reminders"
      />
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await user.click(screen.getByRole("button", { name: "Lead days" }));
    expect(await screen.findByText("Days before renewal.")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/docs/reminders");
  });

  it("falls back to a generic accessible label", () => {
    render(<HelpHint content="x" />);
    expect(screen.getByRole("button", { name: /Help/ })).toBeInTheDocument();
  });
});
