"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Calendar } from "@/components/ui/calendar";

export function CalendarDemo() {
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      className="rounded-md border"
    />
  );
}

/**
 * A date field component that allows users to enter and edit date.
 */
const meta = {
  title: "ui/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  excludeStories: /.*Demo$/,
  render: () => <CalendarDemo />,
} satisfies Meta<typeof Calendar>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default form of the calendar.
 */
export const Default: Story = {};

/**
 * Calendar with form example.
 */
export const Form: Story = {
  render: () => {
    const [date, setDate] = React.useState<Date | undefined>();

    return (
      <form className="space-y-8">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className="rounded-md border"
        />
      </form>
    );
  },
};

export const ShouldSelectDate: Story = {
  name: "when user clicks a date, should select it",
  tags: ["!dev", "!autodocs"],
  render: () => <CalendarDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 🎯 Purpose: Verify clicking a date in the Calendar selects it and shows it visually
    // Find the date button (the 15th of the current month)
    const dateButtons = canvas.getAllByRole("button");
    const date15Button = dateButtons.find(
      (button) => button.textContent?.trim() === "15",
    );

    if (date15Button) {
      // Click the date
      await userEvent.click(date15Button);

      // Verify the selected date has the aria-selected attribute
      await waitFor(() => {
        expect(date15Button).toHaveAttribute("aria-selected", "true");
      });
    }
  },
};
