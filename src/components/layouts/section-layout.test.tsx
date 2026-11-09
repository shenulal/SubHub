import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SECTION_NAV_LINK_PROPS, SectionLayout } from "./section-layout";

let pathname = "/settings/profile";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const scrollIntoView = vi.fn();

function renderLayout() {
  return render(
    <SectionLayout
      title="Settings"
      nav={
        <nav>
          <a href="/settings/profile" aria-current="page">
            Profile
          </a>
        </nav>
      }
    >
      <p>Content</p>
    </SectionLayout>
  );
}

function contentTopAt(top: number) {
  const main = screen.getByRole("main");
  main.style.scrollMarginTop = "80px";
  main.getBoundingClientRect = () => ({ top }) as DOMRect;
  main.scrollIntoView = scrollIntoView;
}

describe("SectionLayout", () => {
  beforeEach(() => {
    pathname = "/settings/profile";
    scrollIntoView.mockReset();
  });

  it("renders the title, the menu and the content", () => {
    renderLayout();
    expect(
      screen.getByRole("heading", { name: "Settings" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("caps the menu to the viewport with its own scroll area", () => {
    renderLayout();
    const menu = screen
      .getByRole("link", { name: "Profile" })
      .closest("aside")?.firstElementChild;
    expect(menu?.className).toContain("xl:overflow-y-auto");
    expect(menu?.className).toContain("xl:max-h-");
  });

  it("uses the 2xl classes when asked", () => {
    render(
      <SectionLayout title="Subscriptions" nav={<nav />} breakpoint="2xl">
        x
      </SectionLayout>
    );
    expect(screen.getByRole("complementary").className).toContain("2xl:sticky");
  });

  it("does not scroll on first render", () => {
    const { rerender } = renderLayout();
    contentTopAt(-300);
    rerender(
      <SectionLayout title="Settings" nav={<nav />}>
        <p>Content</p>
      </SectionLayout>
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("brings the new content's top into view after a menu click when it is hidden", () => {
    const { rerender } = renderLayout();
    contentTopAt(-300);
    pathname = "/settings/privacy";
    rerender(
      <SectionLayout title="Settings" nav={<nav />}>
        <p>Privacy</p>
      </SectionLayout>
    );
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("keeps the page still when the content's top is already visible", () => {
    const { rerender } = renderLayout();
    contentTopAt(120);
    pathname = "/settings/privacy";
    rerender(
      <SectionLayout title="Settings" nav={<nav />}>
        <p>Privacy</p>
      </SectionLayout>
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("tells sub-menu links not to jump to the top", () => {
    expect(SECTION_NAV_LINK_PROPS).toEqual({ scroll: false });
  });
});
