"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, waitFor, within } from "storybook/test";

import { Calendar } from "@/components/ui/calendar";

const meta: Meta = {
  title: "ui/Calendar/Blocks/Range Calendar",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [date, setDate] = React.useState<Date | undefined>(
      new Date(2025, 5, 12),
    );

    return (
      <Calendar
        mode="single"
        defaultMonth={date}
        numberOfMonths={2}
        selected={date}
        onSelect={setDate}
        className="rounded-lg border shadow-sm"
      />
    );
  },
};

export const ShouldDisplayTwoMonths: Story = {
  name: "when rendered, should display two months calendar",
  tags: ["!dev", "!autodocs"],
  render: () => {
    const [date, setDate] = React.useState<Date | undefined>(
      new Date(2025, 5, 12),
    );

    return (
      <div data-testid="range-calendar-container">
        <Calendar
          mode="single"
          defaultMonth={date}
          numberOfMonths={2}
          selected={date}
          onSelect={setDate}
          className="rounded-lg border shadow-sm"
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 🎯 Purpose: Verify the Range Calendar shows two months at once
    const container = canvas.getByTestId("range-calendar-container");
    await expect(container).toBeInTheDocument();

    // Check the calendar grids (2 months = 2 grids)
    await waitFor(
      () => {
        const grids = canvas.getAllByRole("grid");
        expect(grids.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 2000 },
    );

    // Verify the date buttons exist
    await waitFor(
      () => {
        const dateButtons = canvas.getAllByRole("gridcell");
        expect(dateButtons.length).toBeGreaterThan(0);
      },
      { timeout: 2000 },
    );
  },
};
