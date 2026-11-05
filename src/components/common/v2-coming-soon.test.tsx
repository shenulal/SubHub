// src/components/common/v2-coming-soon.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { V2ComingSoon } from "./v2-coming-soon";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("V2ComingSoon", () => {
  describe("rendering", () => {
    it("should render Coming Soon title", () => {
      render(<V2ComingSoon feature="Test feature" />);

      expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    });

    it("should render feature name", () => {
      render(<V2ComingSoon feature="Kanban board" />);

      expect(screen.getByText("Kanban board")).toBeInTheDocument();
    });

    it("should render default description when not provided", () => {
      render(<V2ComingSoon feature="Test feature" />);

      expect(
        screen.getByText("This feature will be available in V2.")
      ).toBeInTheDocument();
    });

    it("should render custom description when provided", () => {
      render(
        <V2ComingSoon
          feature="Test feature"
          description="Custom description."
        />
      );

      expect(screen.getByText("Custom description.")).toBeInTheDocument();
    });

    it("should render dashboard navigation button", () => {
      render(<V2ComingSoon feature="Test feature" />);

      const button = screen.getByRole("link", { name: "Go to Dashboard" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("href", "/dashboard");
    });
  });

  describe("icon", () => {
    it("should render Construction icon", () => {
      render(<V2ComingSoon feature="Test feature" />);

      // Check the container holding the Construction icon
      const iconContainer = document.querySelector(".rounded-full");
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe("styles", () => {
    it("should center content vertically", () => {
      const { container } = render(<V2ComingSoon feature="Test feature" />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("flex");
      expect(wrapper).toHaveClass("flex-col");
      expect(wrapper).toHaveClass("items-center");
      expect(wrapper).toHaveClass("justify-center");
    });
  });
});
