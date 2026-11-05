"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { parseDate } from "chrono-node";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function formatDate(date: Date | undefined) {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const meta: Meta = {
  title: "ui/Calendar/Blocks/Natural Language Picker",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState("In 2 days");
    const [date, setDate] = React.useState<Date | undefined>(
      parseDate(value) || undefined,
    );
    const [month, setMonth] = React.useState<Date | undefined>(date);

    return (
      <div className="flex flex-col gap-3">
        <Label htmlFor="date" className="px-1">
          Schedule Date
        </Label>
        <div className="relative flex gap-2">
          <Input
            id="date"
            value={value}
            placeholder="Tomorrow or next week"
            className="bg-background pr-10"
            onChange={(e) => {
              setValue(e.target.value);
              const date = parseDate(e.target.value);
              if (date) {
                setDate(date);
                setMonth(date);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
              }
            }}
          />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                id="date-picker"
                variant="ghost"
                className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
              >
                <CalendarIcon className="size-3.5" />
                <span className="sr-only">Select date</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                captionLayout="dropdown"
                month={month}
                onMonthChange={setMonth}
                onSelect={(date) => {
                  setDate(date);
                  setValue(formatDate(date));
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="text-muted-foreground px-1 text-sm">
          Your post will be published on{" "}
          <span className="font-medium">{formatDate(date)}</span>.
        </div>
      </div>
    );
  },
};

export const ShouldParseNaturalLanguage: Story = {
  name: "when typing natural language, should parse and update date",
  tags: ["!dev", "!autodocs"],
  render: () => {
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState("In 2 days");
    const [date, setDate] = React.useState<Date | undefined>(
      parseDate(value) || undefined,
    );
    const [month, setMonth] = React.useState<Date | undefined>(date);

    return (
      <div className="flex flex-col gap-3">
        <Label htmlFor="date" className="px-1">
          Schedule Date
        </Label>
        <div className="relative flex gap-2">
          <Input
            id="date"
            value={value}
            placeholder="Tomorrow or next week"
            className="bg-background pr-10"
            data-testid="natural-language-input"
            onChange={(e) => {
              setValue(e.target.value);
              const date = parseDate(e.target.value);
              if (date) {
                setDate(date);
                setMonth(date);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
              }
            }}
          />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                id="date-picker"
                variant="ghost"
                className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                data-testid="calendar-button"
              >
                <CalendarIcon className="size-3.5" />
                <span className="sr-only">Select date</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                captionLayout="dropdown"
                month={month}
                onMonthChange={setMonth}
                onSelect={(date) => {
                  setDate(date);
                  setValue(formatDate(date));
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div
          className="text-muted-foreground px-1 text-sm"
          data-testid="publish-message"
        >
          Your post will be published on{" "}
          <span className="font-medium">{formatDate(date)}</span>.
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 🎯 Purpose: Verify chrono-node parses and updates the date from natural-language input
    const input = canvas.getByTestId("natural-language-input");
    await expect(input).toBeInTheDocument();

    // Check the existing value
    await expect(input).toHaveValue("In 2 days");

    // Change the natural-language input (to "tomorrow")
    await userEvent.clear(input);
    await userEvent.type(input, "tomorrow");

    await waitFor(
      () => {
        // Verify the Input value changed
        expect(input).toHaveValue("tomorrow");
      },
      { timeout: 2000 },
    );

    // Click the Calendar button to open the Popover
    const calendarButton = canvas.getByTestId("calendar-button");
    await userEvent.click(calendarButton);

    await waitFor(
      () => {
        // Verify the Popover is open (the Calendar is shown)
        const calendar = canvas.getByRole("grid");
        expect(calendar).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  },
};
