import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";

function LabelDemo() {
  return (
    <div>
      <div className="flex items-center space-x-2">
        <Checkbox id="terms" />
        <Label htmlFor="terms">Accept terms and conditions</Label>
      </div>
    </div>
  );
}

/**
 * Renders an accessible label associated with controls.
 */
const meta = {
  title: "ui/Label",
  component: Label,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    children: "Label",
    htmlFor: "input",
  },
  excludeStories: /.*Demo$/,
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default form of the label.
 */
export const Default: Story = {};

/**
 * Label with checkbox example.
 */
export const WithCheckbox: Story = {
  render: () => <LabelDemo />,
};

export const ShouldToggleCheckboxWhenClicked: Story = {
  name: "when label is clicked, should toggle the associated checkbox",
  tags: ["!dev", "!autodocs"],
  render: () => <LabelDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText("Accept terms and conditions");
    const checkbox = canvas.getByRole("checkbox") as HTMLInputElement;

    // 🎯 Purpose: Verify clicking the Label toggles the linked checkbox
    await expect(checkbox).not.toBeChecked();

    await userEvent.click(label);
    await expect(checkbox).toBeChecked();

    await userEvent.click(label);
    await expect(checkbox).not.toBeChecked();
  },
};

export const ShouldFocusInputWithHtmlFor: Story = {
  name: "when label with htmlFor is clicked, should focus the associated input",
  tags: ["!dev", "!autodocs"],
  render: () => {
    const [value, setValue] = React.useState("");

    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="email-input">Email Address</Label>
        <Input
          id="email-input"
          type="email"
          placeholder="Enter your email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div
          className="text-muted-foreground text-sm"
          data-testid="value-display"
        >
          Value: {value || "(empty)"}
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 🎯 Purpose: Verify clicking a Label linked via htmlFor moves focus to the Input

    // Find the Label and Input elements
    const label = canvas.getByText("Email Address");
    const input = canvas.getByPlaceholderText(
      "Enter your email",
    ) as HTMLInputElement;

    // Check the initial state
    await expect(input).not.toHaveFocus();

    // Clicking the Label moves focus to the Input
    await userEvent.click(label);
    await expect(input).toHaveFocus();

    // Type a value into the Input
    await userEvent.type(input, "test@example.com");

    // Verify the value is shown
    const valueDisplay = canvas.getByTestId("value-display");
    await expect(valueDisplay).toHaveTextContent("Value: test@example.com");
  },
};
