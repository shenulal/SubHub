// src/components/subscriptions/notification-settings.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationSettings } from "./notification-settings";

describe("NotificationSettings", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the default notification settings", () => {
    render(
      <NotificationSettings
        subscriptionId="sub-1"
        renewalAlert30={true}
        renewalAlert60={false}
        renewalAlert90={false}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText("Notification settings")).toBeInTheDocument();
    expect(screen.getByText("30 days before alert")).toBeInTheDocument();
    expect(screen.getByText("60 days before alert")).toBeInTheDocument();
    expect(screen.getByText("90 days before alert")).toBeInTheDocument();
  });

  it("shows enabled alerts as checked", () => {
    render(
      <NotificationSettings
        subscriptionId="sub-1"
        renewalAlert30={true}
        renewalAlert60={true}
        renewalAlert90={false}
        onChange={mockOnChange}
      />
    );

    const switches = screen.getAllByRole("switch");
    expect(switches[0]).toHaveAttribute("aria-checked", "true"); // 30 days
    expect(switches[1]).toHaveAttribute("aria-checked", "true"); // 60 days
    expect(switches[2]).toHaveAttribute("aria-checked", "false"); // 90 days
  });

  it("calls onChange when a switch is clicked", async () => {
    render(
      <NotificationSettings
        subscriptionId="sub-1"
        renewalAlert30={true}
        renewalAlert60={false}
        renewalAlert90={false}
        onChange={mockOnChange}
      />
    );

    const switches = screen.getAllByRole("switch");

    // Enable the 60-day alert
    fireEvent.click(switches[1]);

    expect(mockOnChange).toHaveBeenCalledWith("renewalAlert60", true);
  });

  it("can enable a disabled alert", async () => {
    render(
      <NotificationSettings
        subscriptionId="sub-1"
        renewalAlert30={false}
        renewalAlert60={false}
        renewalAlert90={false}
        onChange={mockOnChange}
      />
    );

    const switches = screen.getAllByRole("switch");

    // Enable the 30-day alert
    fireEvent.click(switches[0]);

    expect(mockOnChange).toHaveBeenCalledWith("renewalAlert30", true);
  });

  it("can disable an enabled alert", async () => {
    render(
      <NotificationSettings
        subscriptionId="sub-1"
        renewalAlert30={true}
        renewalAlert60={false}
        renewalAlert90={false}
        onChange={mockOnChange}
      />
    );

    const switches = screen.getAllByRole("switch");

    // Disable the 30-day alert
    fireEvent.click(switches[0]);

    expect(mockOnChange).toHaveBeenCalledWith("renewalAlert30", false);
  });

  it("disables the switches when disabled", () => {
    render(
      <NotificationSettings
        subscriptionId="sub-1"
        renewalAlert30={true}
        renewalAlert60={false}
        renewalAlert90={false}
        onChange={mockOnChange}
        disabled={true}
      />
    );

    const switches = screen.getAllByRole("switch");
    switches.forEach((sw) => {
      expect(sw).toBeDisabled();
    });
  });

  it("shows the alert descriptions", () => {
    render(
      <NotificationSettings
        subscriptionId="sub-1"
        renewalAlert30={true}
        renewalAlert60={false}
        renewalAlert90={false}
        onChange={mockOnChange}
      />
    );

    expect(
      screen.getByText(/email alert 30 days before renewal/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/email alert 60 days before renewal/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/email alert 90 days before renewal/)
    ).toBeInTheDocument();
  });
});
