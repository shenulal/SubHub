import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsSidebar } from "./settings-sidebar";

describe("SettingsSidebar", () => {
  it("shows the platform entries only to members who can manage settings", () => {
    const { rerender } = render(<SettingsSidebar isAdmin />);
    expect(
      screen.getByRole("link", { name: /Workspace settings/ })
    ).toHaveAttribute("href", "/settings/workspace");
    expect(screen.getByRole("link", { name: /Master data/ })).toHaveAttribute(
      "href",
      "/settings/masters"
    );
    expect(
      screen.getByRole("link", { name: /Roles & permissions/ })
    ).toHaveAttribute("href", "/settings/roles");
    expect(
      screen.getByRole("link", { name: /Notification templates/ })
    ).toHaveAttribute("href", "/settings/notification-templates");

    rerender(<SettingsSidebar isAdmin={false} />);
    expect(
      screen.queryByRole("link", { name: /Workspace settings/ })
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: /Privacy & data/ })
    ).toHaveAttribute("href", "/settings/privacy");
  });

  it("gates each entry on the viewer's permissions", () => {
    render(
      <SettingsSidebar
        permissions={["notifications:manage_own", "roles:manage", "tags:read"]}
      />
    );
    expect(
      screen.getByRole("link", { name: /Roles & permissions/ })
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /Master data/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Profile/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Appearance/ })).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /Workspace settings/ })
    ).toBeNull();
    expect(screen.queryByRole("link", { name: /Organization/ })).toBeNull();
    expect(
      screen.queryByRole("link", { name: /Notification templates/ })
    ).toBeNull();
    expect(screen.queryByRole("link", { name: /Mailboxes/ })).toBeNull();
  });
});
