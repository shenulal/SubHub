import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function AlertDialogDemo() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Show Dialog</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your
            account and remove your data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A modal dialog that interrupts the user with important content and expects
 * a response.
 */
const meta = {
  title: "ui/AlertDialog",
  component: AlertDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  excludeStories: /.*Demo$/,
  render: () => <AlertDialogDemo />,
} satisfies Meta<typeof AlertDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default form of the alert dialog.
 */
export const Default: Story = {};

export const ShouldOpenAndCloseDialog: Story = {
  name: "when trigger is clicked, should open dialog and allow cancel/continue",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 🎯 Purpose: Verify the Alert Dialog opens from the trigger button and the Cancel/Continue buttons work
    const triggerButton = canvas.getByRole("button", { name: /show dialog/i });
    await expect(triggerButton).toBeInTheDocument();

    // Click the trigger button to open the dialog
    await userEvent.click(triggerButton);

    // Verify the dialog is open
    await waitFor(async () => {
      const dialogTitle = await canvas.findByRole("heading", {
        name: /are you absolutely sure/i,
      });
      await expect(dialogTitle).toBeInTheDocument();
    });

    // Check the Cancel button
    const cancelButton = canvas.getByRole("button", { name: /cancel/i });
    await expect(cancelButton).toBeInTheDocument();

    // Check the Continue button
    const continueButton = canvas.getByRole("button", { name: /continue/i });
    await expect(continueButton).toBeInTheDocument();

    // Click Cancel (closes the dialog)
    await userEvent.click(cancelButton);
  },
};
