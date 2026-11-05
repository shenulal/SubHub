import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, within } from "storybook/test";

/**
 * Accessible resizable panel groups and layouts with keyboard support.
 */
const meta = {
  title: "ui/Resizable",
  component: ResizablePanelGroup,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  excludeStories: /.*Demo$/,
  argTypes: {
    direction: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "The direction of the resizable panel group",
    },
  },
  args: {
    direction: "horizontal",
    className: "max-w-md rounded-lg border md:min-w-[450px]",
  },
  render: (args) => (
    <ResizablePanelGroup {...args}>
      <ResizablePanel defaultSize={50}>
        <div className="flex h-[200px] items-center justify-center p-6">
          <span className="font-semibold">One</span>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={50}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={25}>
            <div className="flex h-full items-center justify-center p-6">
              <span className="font-semibold">Two</span>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={75}>
            <div className="flex h-full items-center justify-center p-6">
              <span className="font-semibold">Three</span>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
} satisfies Meta<typeof ResizablePanelGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default form of the resizable panel group.
 */
export const Default: Story = {};

/**
 * Vertical layout for resizable panels.
 */
export const Vertical: Story = {
  render: () => (
    <ResizablePanelGroup
      direction="vertical"
      className="min-h-[200px] max-w-md rounded-lg border md:min-w-[450px]"
    >
      <ResizablePanel defaultSize={25}>
        <div className="flex h-full items-center justify-center p-6">
          <span className="font-semibold">Header</span>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={75}>
        <div className="flex h-full items-center justify-center p-6">
          <span className="font-semibold">Content</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

/**
 * Resizable handle with visible handle.
 */
export const WithHandle: Story = {
  render: () => (
    <ResizablePanelGroup
      direction="horizontal"
      className="min-h-[200px] max-w-md rounded-lg border md:min-w-[450px]"
    >
      <ResizablePanel defaultSize={25}>
        <div className="flex h-full items-center justify-center p-6">
          <span className="font-semibold">Sidebar</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={75}>
        <div className="flex h-full items-center justify-center p-6">
          <span className="font-semibold">Content</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

export function ResizableDemo() {
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="max-w-md rounded-lg border md:min-w-[450px]"
    >
      <ResizablePanel defaultSize={50}>
        <div className="flex h-[200px] items-center justify-center p-6">
          <span className="font-semibold">One</span>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={50}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={25}>
            <div className="flex h-full items-center justify-center p-6">
              <span className="font-semibold">Two</span>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={75}>
            <div className="flex h-full items-center justify-center p-6">
              <span className="font-semibold">Three</span>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export const ShouldRenderResizablePanels: Story = {
  name: "when resizable panels are rendered, should display all panels and handles",
  tags: ["!dev", "!autodocs"],
  render: () => {
    const [leftSize, setLeftSize] = React.useState(50);
    const [rightSize, setRightSize] = React.useState(50);

    return (
      <div className="w-full">
        <ResizablePanelGroup
          direction="horizontal"
          className="max-w-md rounded-lg border md:min-w-[450px]"
          data-testid="resizable-group"
        >
          <ResizablePanel
            defaultSize={leftSize}
            onResize={(size) => setLeftSize(size)}
            data-testid="left-panel"
          >
            <div className="flex h-[200px] items-center justify-center p-6">
              <span className="font-semibold" data-testid="left-content">
                Left Panel
              </span>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle data-testid="resize-handle" />
          <ResizablePanel
            defaultSize={rightSize}
            onResize={(size) => setRightSize(size)}
            data-testid="right-panel"
          >
            <div className="flex h-[200px] items-center justify-center p-6">
              <span className="font-semibold" data-testid="right-content">
                Right Panel
              </span>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        <div
          className="text-muted-foreground mt-4 text-center text-sm"
          data-testid="size-display"
        >
          Left: {Math.round(leftSize)}% | Right: {Math.round(rightSize)}%
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 🎯 Purpose: Verify the Resizable component renders panels and handles correctly and shows the initial sizes

    // Verify the Resizable Group exists
    const resizableGroup = canvas.getByTestId("resizable-group");
    await expect(resizableGroup).toBeInTheDocument();

    // Check the left panel
    const leftPanel = canvas.getByTestId("left-panel");
    await expect(leftPanel).toBeInTheDocument();
    const leftContent = canvas.getByTestId("left-content");
    await expect(leftContent).toHaveTextContent("Left Panel");

    // Check the right panel
    const rightPanel = canvas.getByTestId("right-panel");
    await expect(rightPanel).toBeInTheDocument();
    const rightContent = canvas.getByTestId("right-content");
    await expect(rightContent).toHaveTextContent("Right Panel");

    // Check the Resize Handle
    const resizeHandle = canvas.getByTestId("resize-handle");
    await expect(resizeHandle).toBeInTheDocument();

    // Check the initial size display (50% / 50%)
    const sizeDisplay = canvas.getByTestId("size-display");
    await expect(sizeDisplay).toHaveTextContent(/Left: 50% \| Right: 50%/);
  },
};
