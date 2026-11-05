import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Copy } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { expect, fn, userEvent, within } from "storybook/test";

function DialogDemo() {
  return (
    <Dialog>
      <form>
        <DialogTrigger asChild>
          <Button variant="outline">Open Dialog</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Make changes to your profile here. Click save when you&apos;re
              done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3">
              <Label htmlFor="name-1">Name</Label>
              <Input id="name-1" name="name" defaultValue="Pedro Duarte" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="username-1">Username</Label>
              <Input id="username-1" name="username" defaultValue="@peduarte" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  );
}

// Custom Close Button Dialog (Share)
function CustomCloseButtonDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Share</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share link</DialogTitle>
          <DialogDescription>
            Anyone who has this link will be able to view this.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="link" className="sr-only">
              Link
            </Label>
            <Input
              id="link"
              defaultValue="https://ui.shadcn.com/docs/installation"
              readOnly
            />
          </div>
          <Button type="submit" size="sm" className="px-3">
            <span className="sr-only">Copy</span>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A dialog component for editing user profile information.
 */
const meta = {
  title: "ui/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    onOpenChange: fn(),
  },
  excludeStories: /.*Demo$/,
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default Dialog modal. The edit-profile form example includes a title, description, input fields and buttons;
 * use it for important tasks or when extra input is needed. The modal overlay keeps the user focused.
 */
export const Default: Story = {
  render: () => <DialogDemo />,
};

/**
 * A Dialog with a custom close button. The share-link example provides a read-only input and a copy button,
 * and uses DialogClose for the cancel action. Suited to informational modals such as sharing or notices.
 */
export const CustomCloseButton: Story = {
  render: () => <CustomCloseButtonDemo />,
};

/**
 * Ref example: pass a ref to DialogContent to access the Radix UI primitive.
 * This example shows how to open and close the Dialog programmatically.
 */
export const WithRef: Story = {
  render: () => {
    // 🎯 Purpose: Create the ref using the Radix UI Dialog primitive's ElementRef type
    const contentRef =
      useRef<React.ElementRef<typeof DialogPrimitive.Content>>(null);
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setMessage("Form submitted successfully!");
      // Close the Dialog after 3 seconds
      setTimeout(() => {
        setOpen(false);
        setMessage("");
      }, 3000);
    };

    return (
      <div className="flex flex-col gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Open Controlled Dialog</Button>
          </DialogTrigger>
          <DialogContent ref={contentRef} className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Controlled Dialog Example</DialogTitle>
              <DialogDescription>
                This dialog can be controlled programmatically using state and
                ref.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4">
                <div className="grid gap-3">
                  <Label htmlFor="email-input">Email</Label>
                  <Input
                    id="email-input"
                    type="email"
                    placeholder="example@email.com"
                    required
                  />
                </div>
                {message && (
                  <div className="text-sm text-green-600 dark:text-green-400">
                    {message}
                  </div>
                )}
              </div>
              <DialogFooter className="mt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Submit</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Open via State
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            Close via State
          </Button>
        </div>

        <p className="text-muted-foreground text-sm">
          Dialog state: {open ? "Open" : "Closed"}
        </p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    // 🎯 Purpose: Test the Dialog ref and state control via a play function
    const canvas = within(canvasElement);

    // Open the Dialog with the "Open via State" button
    const openButton = canvas.getByRole("button", { name: "Open via State" });
    await userEvent.click(openButton);

    // Verify the Dialog is open
    const dialogTitle = await canvas.findByText("Controlled Dialog Example");
    await expect(dialogTitle).toBeVisible();

    // Check the Dialog state text
    const stateText = canvas.getByText(/Dialog state:/);
    await expect(stateText).toHaveTextContent("Dialog state: Open");
  },
};
