// src/components/notifications/notification-preferences-form.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/notifications/preferences", () => ({
  updateNotificationPreferences: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { updateNotificationPreferences } from "@/actions/notifications/preferences";
import { ALL_NOTIFICATION_EVENT_TYPES } from "@/types/notification";
import { NotificationPreferencesForm } from "./notification-preferences-form";

const matrix = {
  channels: ["IN_APP", "EMAIL"] as const,
  cells: ALL_NOTIFICATION_EVENT_TYPES.flatMap((eventType) =>
    (["IN_APP", "EMAIL"] as const).map((channel) => ({
      eventType,
      channel,
      enabled: true,
    }))
  ),
  reminderLeadDays: [7],
  reminderLeadDayOptions: [1, 3, 7],
  organizationDefaultLeadDays: [7, 3, 1],
};

describe("NotificationPreferencesForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateNotificationPreferences).mockResolvedValue({
      success: true,
      data: matrix as never,
    });
  });

  it("renders a switch per event × channel plus digest", () => {
    render(<NotificationPreferencesForm initial={matrix as never} />);
    // 14 grid events (4 groups) × 2 channels + digest switch
    expect(screen.getAllByRole("switch")).toHaveLength(14 * 2 + 1);
  });

  it("persists a toggled cell", async () => {
    render(<NotificationPreferencesForm initial={matrix as never} />);
    const target = screen.getByRole("switch", {
      name: "Renewal reminders via 이메일",
    });
    fireEvent.click(target);
    await waitFor(() =>
      expect(updateNotificationPreferences).toHaveBeenCalledWith({
        cells: [
          { eventType: "RENEWAL_REMINDER", channel: "EMAIL", enabled: false },
        ],
      })
    );
  });

  it("persists reminder lead days", async () => {
    render(<NotificationPreferencesForm initial={matrix as never} />);
    fireEvent.click(screen.getByRole("button", { name: "3d", pressed: false }));
    await waitFor(() =>
      expect(updateNotificationPreferences).toHaveBeenCalledWith({
        reminderLeadDays: [7, 3],
      })
    );
  });

  it("rolls back on failure", async () => {
    vi.mocked(updateNotificationPreferences).mockResolvedValue({
      success: false,
      error: "nope",
    });
    render(<NotificationPreferencesForm initial={matrix as never} />);
    const button = screen.getByRole("button", { name: "7d" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
  });
});
