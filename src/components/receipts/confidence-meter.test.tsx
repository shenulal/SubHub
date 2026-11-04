// src/components/receipts/confidence-meter.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfidenceMeter } from "./confidence-meter";

describe("ConfidenceMeter", () => {
  it("renders an accessible meter with the bucket as data attribute", () => {
    render(<ConfidenceMeter value={0.92} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "92");
    expect(meter).toHaveAttribute("data-level", "high");
    expect(screen.getByText(/92%/)).toBeInTheDocument();
  });

  it("clamps out-of-range values and supports compact mode", () => {
    render(<ConfidenceMeter value={1.7} compact />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("marks low confidence", () => {
    render(<ConfidenceMeter value={0.3} />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-level", "low");
  });
});
