import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsSidebar } from "./settings-sidebar";

describe("SettingsSidebar", () => {
  it("shows the platform entries only to members who can manage settings", () => {
    const { rerender } = render(<SettingsSidebar isAdmin />);
    expect(
      screen.getByRole("link", { name: /워크스페이스 설정/ })
    ).toHaveAttribute("href", "/settings/workspace");
    expect(screen.getByRole("link", { name: /마스터 데이터/ })).toHaveAttribute(
      "href",
      "/settings/masters"
    );
    expect(screen.getByRole("link", { name: /역할 및 권한/ })).toHaveAttribute(
      "href",
      "/settings/roles"
    );
    expect(screen.getByRole("link", { name: /알림 템플릿/ })).toHaveAttribute(
      "href",
      "/settings/notification-templates"
    );

    rerender(<SettingsSidebar isAdmin={false} />);
    expect(
      screen.queryByRole("link", { name: /워크스페이스 설정/ })
    ).toBeNull();
    expect(screen.getByRole("link", { name: /개인정보/ })).toHaveAttribute(
      "href",
      "/settings/privacy"
    );
  });
});
