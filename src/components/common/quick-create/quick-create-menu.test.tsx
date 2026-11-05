// src/components/common/quick-create/quick-create-menu.test.tsx
import { renderWithPermissions } from "@/test/permission-wrapper";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuickCreateContext } from "./quick-create-context";
import { isTypingTarget, QuickCreateMenu } from "./quick-create-menu";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

function renderMenu(permissions: string[], open = vi.fn()) {
  renderWithPermissions(
    <QuickCreateContext.Provider value={{ open }}>
      <QuickCreateMenu />
    </QuickCreateContext.Provider>,
    permissions
  );
  return open;
}

describe("QuickCreateMenu", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only the entries the viewer may create", async () => {
    renderMenu(["subscriptions:create", "tags:create"]);
    await userEvent.click(screen.getByTestId("quick-create-trigger"));

    expect(
      await screen.findByRole("menuitem", { name: /subscription/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /tag/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /^app$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /invite member/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /cost centre/i })
    ).not.toBeInTheDocument();
  });

  it("shows app, team, invite and masters entries to administrators", async () => {
    renderMenu([
      "apps:manage",
      "teams:manage",
      "members:invite",
      "masters:manage",
      "categories:manage",
    ]);
    await userEvent.click(screen.getByTestId("quick-create-trigger"));

    for (const name of [
      "App",
      "Team",
      "Invite member",
      "Cost centre",
      "Payment method",
      "Category",
    ]) {
      expect(
        await screen.findByRole("menuitem", { name: new RegExp(name, "i") })
      ).toBeInTheDocument();
    }
  });

  it("renders nothing without any create permission", () => {
    renderMenu(["subscriptions:read"]);
    expect(
      screen.queryByTestId("quick-create-trigger")
    ).not.toBeInTheDocument();
  });

  it("opens the chosen dialog through the quick-create context", async () => {
    const open = renderMenu(["apps:manage"]);
    await userEvent.click(screen.getByTestId("quick-create-trigger"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /^app$/i })
    );
    expect(open).toHaveBeenCalledWith("app");
  });

  it("opens with the N shortcut but not while typing", async () => {
    renderMenu(["tags:create"]);
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "n" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "n" });
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    input.remove();
  });
});

describe("isTypingTarget", () => {
  it("treats inputs, textareas and editable content as typing targets", () => {
    const textarea = document.createElement("textarea");
    const div = document.createElement("div");
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
