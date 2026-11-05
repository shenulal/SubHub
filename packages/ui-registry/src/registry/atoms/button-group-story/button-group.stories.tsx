import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  ChevronDown,
  Minus,
  Plus,
  Search,
} from "lucide-react";
import * as React from "react";

/**
 * A container that groups related buttons together.
 * Automatically applies styling for grouped buttons and manages layout.
 */
const meta = {
  title: "ui/ButtonGroup",
  component: ButtonGroup,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Basic usage.
 * Groups two buttons.
 */
export const BasicUsage: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Button 1</Button>
      <Button variant="outline">Button 2</Button>
    </ButtonGroup>
  ),
};

/**
 * A vertical button group.
 * Suited to increment/decrement controls.
 */
export const Orientation: Story = {
  render: () => (
    <ButtonGroup
      orientation="vertical"
      aria-label="Media controls"
      className="h-fit"
    >
      <Button variant="outline" size="icon">
        <Plus />
      </Button>
      <Button variant="outline" size="icon">
        <Minus />
      </Button>
    </ButtonGroup>
  ),
};

/**
 * Button groups in various sizes.
 * Combines small buttons with icon buttons.
 */
export const Size: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <ButtonGroup>
        <Button variant="outline" size="sm">
          Small
        </Button>
        <Button variant="outline" size="sm">
          Button
        </Button>
        <Button variant="outline" size="sm">
          Group
        </Button>
        <Button variant="outline" size="icon-sm">
          <Plus />
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button variant="outline">Default</Button>
        <Button variant="outline">Button</Button>
        <Button variant="outline">Group</Button>
        <Button variant="outline" size="icon">
          <Plus />
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button variant="outline" size="lg">
          Large
        </Button>
        <Button variant="outline" size="lg">
          Button
        </Button>
        <Button variant="outline" size="lg">
          Group
        </Button>
        <Button variant="outline" size="icon-lg">
          <Plus />
        </Button>
      </ButtonGroup>
    </div>
  ),
};

/**
 * Nested button groups.
 * Useful for pagination controls.
 */
export const Nested: Story = {
  render: () => (
    <ButtonGroup>
      <ButtonGroup>
        <Button variant="outline" size="sm">
          1
        </Button>
        <Button variant="outline" size="sm">
          2
        </Button>
        <Button variant="outline" size="sm">
          3
        </Button>
        <Button variant="outline" size="sm">
          4
        </Button>
        <Button variant="outline" size="sm">
          5
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button variant="outline" size="icon-sm" aria-label="Previous">
          <ArrowLeft />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Next">
          <ArrowRight />
        </Button>
      </ButtonGroup>
    </ButtonGroup>
  ),
};

/**
 * A button group with a separator.
 * Shows a divider between the Copy and Paste buttons.
 */
export const Separator: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="secondary" size="sm">
        Copy
      </Button>
      <ButtonGroupSeparator />
      <Button variant="secondary" size="sm">
        Paste
      </Button>
    </ButtonGroup>
  ),
};

/**
 * A split button example.
 * Separates the main button from the icon button.
 */
export const Split: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="secondary">Button</Button>
      <ButtonGroupSeparator />
      <Button variant="secondary" size="icon">
        <Plus />
      </Button>
    </ButtonGroup>
  ),
};

/**
 * A button group used with an Input.
 * Suited to search UIs.
 */
export const WithInput: Story = {
  render: () => (
    <ButtonGroup>
      <Input placeholder="Search..." />
      <Button variant="outline" aria-label="Search">
        <Search />
      </Button>
    </ButtonGroup>
  ),
};

/**
 * An Input Group example.
 * Groups a complex input field with buttons.
 */
export const InputGroupExample: Story = {
  render: () => {
    const [voiceEnabled, setVoiceEnabled] = React.useState(false);

    return (
      <TooltipProvider>
        <ButtonGroup className="[--radius:9999rem]">
          <ButtonGroup>
            <Button variant="outline" size="icon">
              <Plus />
            </Button>
          </ButtonGroup>
          <ButtonGroup>
            <InputGroup>
              <InputGroupInput
                placeholder={
                  voiceEnabled
                    ? "Record and send audio..."
                    : "Send a message..."
                }
                disabled={voiceEnabled}
              />
              <InputGroupAddon align="inline-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InputGroupButton
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                      size="icon-xs"
                      data-active={voiceEnabled}
                      className="data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                    >
                      <AudioLines />
                    </InputGroupButton>
                  </TooltipTrigger>
                  <TooltipContent>
                    {voiceEnabled ? "Disable voice" : "Enable voice"}
                  </TooltipContent>
                </Tooltip>
              </InputGroupAddon>
            </InputGroup>
          </ButtonGroup>
        </ButtonGroup>
      </TooltipProvider>
    );
  },
};

/**
 * A button group used with a Dropdown Menu.
 * Adds a dropdown to the split button pattern.
 */
export const WithDropdownMenu: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Follow</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="!pl-2">
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="[--radius:1rem]">
          <DropdownMenuItem>
            <span>Mute Conversation</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Mark as Read</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Report Conversation</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Block User</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Share Conversation</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Copy Conversation</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  ),
};

/**
 * A button group used with a Select.
 * Useful for choosing a page size.
 */
export const WithSelect: Story = {
  render: () => (
    <ButtonGroup>
      <Select defaultValue="10">
        <SelectTrigger className="w-[80px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="10">10</SelectItem>
          <SelectItem value="20">20</SelectItem>
          <SelectItem value="50">50</SelectItem>
          <SelectItem value="100">100</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="secondary">Apply</Button>
    </ButtonGroup>
  ),
};

/**
 * A button group used with a Popover.
 * Useful for showing additional settings or information.
 */
export const WithPopover: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Action</Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon">
            <ChevronDown />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <h4 className="font-medium">Advanced Settings</h4>
            <p className="text-muted-foreground text-sm">
              Configure advanced options for this action.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </ButtonGroup>
  ),
};
