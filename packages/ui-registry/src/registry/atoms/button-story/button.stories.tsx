import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChevronRight, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { expect, fn, userEvent, within } from "storybook/test";

export function ButtonDemo() {
  return <Button>Button</Button>;
}

/**
 * Displays a button or a component that looks like a button.
 */
const meta = {
  title: "ui/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    design: {
      type: "figma",
      url: "https://www.figma.com/file/Q7c53iozMSDxpPnunZsEM6/shadcn-ui-kit-for-Figma---August-2025?node-id=580-9181",
    },
  },
  args: {
    children: "Button",
    variant: "default",
    size: "default",
    disabled: false,
    onClick: fn(),
  },
  excludeStories: /.*Demo$/,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default button style. Use it for primary actions or submit buttons;
 * it provides the strongest visual emphasis.
 */
export const Default: Story = {};

/**
 * The secondary variant, used for supporting actions.
 * Less prominent than the primary button; suited to secondary actions such as Cancel or Back.
 */
export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Secondary",
  },
};

/**
 * The destructive variant, used for delete or other destructive actions.
 * Shown in red to prompt users to decide carefully.
 */
export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Destructive",
  },
};

/**
 * The outline variant, with a border only.
 * Its transparent background feels lighter; suited to secondary actions or filter buttons.
 */
export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Outline",
  },
};

/**
 * The ghost variant, with no border or background.
 * The background appears only on hover; used in navigation and dropdown menus.
 */
export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Ghost",
  },
};

/**
 * The link variant, which looks like a link.
 * An underlined text style for when button behavior is needed within inline text.
 */
export const LinkVariant: Story = {
  args: {
    variant: "link",
    children: "Link",
  },
};

/**
 * An icon-only button. Use size="icon" to make it square;
 * suited to toolbars and action icons. Adding an aria-label is recommended for accessibility.
 */
export const Icon: Story = {
  render: () => (
    <Button variant="outline" size="icon">
      <ChevronRight className="h-4 w-4" />
    </Button>
  ),
};

/**
 * A button showing both text and an icon.
 * Placing the icon before the text visually emphasizes the button's function.
 */
export const WithIcon: Story = {
  render: () => (
    <Button>
      <Mail className="mr-2 h-4 w-4" /> Login with Email
    </Button>
  ),
};

/**
 * A button showing a loading state. It is disabled and shows a spinner icon
 * to tell users an asynchronous operation is in progress.
 */
export const Loading: Story = {
  render: () => (
    <Button disabled>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Please wait
    </Button>
  ),
};

/**
 * Uses the asChild prop to apply the Button styles to another component.
 * Useful for styling a Next.js Link or React Router Link as a button.
 */
export const AsChild: Story = {
  render: () => (
    <Button asChild>
      <Link href="/login">Login</Link>
    </Button>
  ),
};

/**
 * Ref example: pass a ref to Button to access the DOM element directly.
 * This example shows controlling focus through the ref.
 */
export const WithRef: Story = {
  render: () => {
    // 🎯 Purpose: Create an HTMLButtonElement ref to access the focus() method
    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
      <div className="flex flex-col gap-4">
        <Button ref={buttonRef}>Target Button</Button>
        <Button variant="outline" onClick={() => buttonRef.current?.focus()}>
          Focus Button Above
        </Button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    // 🎯 Purpose: Automatically test ref behavior via a play function
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole("button");

    // Click "Focus Button Above" to focus the first button
    await userEvent.click(buttons[1]);

    // Verify the first button received focus
    await expect(buttons[0]).toHaveFocus();
  },
};
