"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const meta: Meta = {
  title: "ui/Calendar/Blocks/Date of Birth Picker",
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
    const [date, setDate] = React.useState<Date | undefined>(undefined);

    return (
      <div className="flex flex-col gap-3">
        <Label htmlFor="date" className="px-1">
          Date of birth
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              id="date"
              className="w-48 justify-between font-normal"
            >
              {date ? date.toLocaleDateString() : "Select date"}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              onSelect={(date) => {
                setDate(date);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
};

export const ShouldSelectBirthDate: Story = {
  name: "when user clicks trigger and selects birth date, should display selected date",
  tags: ["!dev", "!autodocs"],
  render: () => {
    const [open, setOpen] = React.useState(false);
    const [date, setDate] = React.useState<Date | undefined>(undefined);

    return (
      <div className="flex flex-col gap-3">
        <Label htmlFor="date" className="px-1">
          Date of birth
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              id="date"
              className="w-48 justify-between font-normal"
            >
              {date ? date.toLocaleDateString() : "Select date"}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              onSelect={(date) => {
                setDate(date);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 🎯 Purpose: Verify the Date of Birth Picker opens from the trigger button and shows the date after selection
    const triggerButton = canvas.getByRole("button", { name: /select date/i });
    await expect(triggerButton).toBeInTheDocument();

    // Click the trigger button to open the Calendar
    await userEvent.click(triggerButton);

    // Verify the Calendar is open (check the date buttons)
    await waitFor(async () => {
      const dateButtons = await canvas.findAllByRole("button");
      await expect(dateButtons.length).toBeGreaterThan(1);
    });

    // Find the date button (select the 15th)
    const dateButtons = canvas.getAllByRole("button");
    const date15Button = dateButtons.find(
      (button) => button.textContent?.trim() === "15",
    );

    if (date15Button) {
      // Click the date
      await userEvent.click(date15Button);

      // Verify the selected date shows on the button (the Popover closes and the date appears)
      await waitFor(() => {
        expect(triggerButton.textContent).not.toMatch(/select date/i);
      });
    }
  },
};
