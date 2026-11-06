// src/components/apps/app-logo.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppLogo } from "./app-logo";

describe("AppLogo", () => {
  it("renders the stored icon and falls back to the initial when it fails", () => {
    render(<AppLogo src="/api/v1/app-logos/o/x.png" name="Figma" />);
    const img = screen.getByRole("img", { name: "Figma" });
    expect(img).toHaveAttribute("src", "/api/v1/app-logos/o/x.png");
    fireEvent.error(img);
    expect(screen.getByTestId("app-logo-fallback")).toHaveTextContent("F");
  });

  it("shows the initial when there is no icon", () => {
    render(<AppLogo src={null} name="notion" />);
    expect(screen.getByTestId("app-logo-fallback")).toHaveTextContent("N");
  });
});
