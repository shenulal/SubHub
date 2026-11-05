import { expect, fn, userEvent, within } from "storybook/test";
// Replace nextjs-vite with the name of your framework
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Displays a form input field or a component that looks like an input field.
 */
const meta = {
  title: "ui/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {},
  args: {
    className: "w-96",
    type: "email",
    placeholder: "Email",
    disabled: false,
    onChange: fn(),
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default input field style. It accepts various input types such as email and text,
 * and uses the placeholder for guidance. It is the most basic input component in forms.
 */
export const Default: Story = {};

/**
 * An input field for file uploads. type="file" lets users choose a local file;
 * pair it with a Label for accessibility. Used for profile photos, document attachments and similar.
 */
export const File: Story = {
  args: {
    type: "file",
    placeholder: undefined,
    className: "max-w-sm",
  },
  render: (args) => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="picture">Picture</Label>
      <Input {...args} id="picture" />
    </div>
  ),
};

/**
 * A disabled input field. The disabled prop blocks input and dims the field,
 * showing visually that it cannot accept input right now. Used in conditional forms.
 */
export const Disabled: Story = {
  args: { disabled: true },
};

/**
 * An input field used with a Label. Placing the Label component above or beside the input
 * gives users clear guidance. Linking htmlFor and id ensures accessibility.
 */
export const WithLabel: Story = {
  render: (args) => (
    <div className="grid items-center gap-1.5">
      <Label htmlFor="email">{args.placeholder}</Label>
      <Input {...args} id="email" />
    </div>
  ),
};

/**
 * An input field with helper text. Descriptive text below the input
 * provides extra guidance or format information. Useful for explaining complex input requirements.
 */
export const WithHelperText: Story = {
  render: (args) => (
    <div className="grid items-center gap-1.5">
      <Label htmlFor="email-2">{args.placeholder}</Label>
      <Input {...args} id="email-2" />
      <p className="text-foreground/60 text-sm">Enter your email address.</p>
    </div>
  ),
};

/**
 * An input field used with a Button. A submit button beside the input
 * allows immediate action. Suited to search, subscribe and quick-entry forms.
 */
export const WithButton: Story = {
  render: (args) => (
    <div className="flex w-full max-w-sm items-center space-x-2">
      <Input {...args} />
      <Button type="submit" variant="outline">
        Subscribe
      </Button>
    </div>
  ),
};

export const ShouldEnterText: Story = {
  name: "when user enters text, should see it in the input field",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvas, step }) => {
    const input = await canvas.findByPlaceholderText(/email/i);
    const mockedInput = "mocked@shadcn.com";

    await step("focus and type into the input field", async () => {
      await userEvent.click(input);
      await userEvent.type(input, mockedInput);
    });

    expect(input).toHaveValue(mockedInput);
  },
};

/**
 * Ref example: pass a ref to Input to access the DOM element directly.
 * This example shows controlling focus and select through the ref.
 */
export const WithRef: Story = {
  render: () => {
    // 🎯 Purpose: Create an HTMLInputElement ref to access the focus() and select() methods
    const inputRef = useRef<HTMLInputElement>(null);

    return (
      <div className="grid w-full max-w-sm items-center gap-4">
        <div className="grid items-center gap-1.5">
          <Label htmlFor="target-input">Target Input</Label>
          <Input
            ref={inputRef}
            id="target-input"
            type="text"
            placeholder="Type something..."
            defaultValue="Example text"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.focus()}
          >
            Focus Input
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.select()}
          >
            Select Text
          </Button>
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    // 🎯 Purpose: Automatically test ref behavior via a play function
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Target Input") as HTMLInputElement;
    const focusButton = canvas.getByRole("button", { name: "Focus Input" });
    const selectButton = canvas.getByRole("button", { name: "Select Text" });

    // Click "Focus Input" to focus the input
    await userEvent.click(focusButton);
    await expect(input).toHaveFocus();

    // Click "Select Text" to select the text
    await userEvent.click(selectButton);
    await expect(input.selectionStart).toBe(0);
    await expect(input.selectionEnd).toBe(input.value.length);
  },
};
