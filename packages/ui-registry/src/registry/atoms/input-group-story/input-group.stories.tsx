import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  Copy,
  Eye,
  EyeOff,
  InfoIcon,
  LoaderIcon,
  PlusIcon,
  Search,
  XIcon,
} from "lucide-react";
import * as React from "react";

/**
 * Groups input elements with related buttons, icons, or text.
 * Provides a consistent way to enhance inputs with additional functionality.
 */
const meta = {
  title: "ui/InputGroup",
  component: InputGroup,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
} satisfies Meta<typeof InputGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A basic input group.
 * Groups an input field with related elements.
 */
export const Default: Story = {
  render: () => (
    <InputGroup className="w-[300px]">
      <InputGroupInput placeholder="Search..." />
    </InputGroup>
  ),
};

/**
 * The InputGroupDemo example.
 * Shows various input group patterns.
 */
export const Demo: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-6">
      <InputGroup>
        <InputGroupInput placeholder="Search..." />
        <InputGroupAddon>
          <Search className="h-4 w-4" />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">12 results</InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupInput placeholder="example.com" className="!pl-1" />
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <InputGroupButton className="rounded-full" size="icon-xs">
                <InfoIcon className="h-4 w-4" />
              </InputGroupButton>
            </TooltipTrigger>
            <TooltipContent>This is content in a tooltip.</TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupTextarea placeholder="Ask, Search or Chat..." />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs">
            <ArrowUpIcon />
          </InputGroupButton>
          <Kbd>Enter</Kbd>
        </InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupAddon>
          <InputGroupButton size="icon-xs">
            <PlusIcon />
          </InputGroupButton>
          <span className="h-3 w-px border-r" />
        </InputGroupAddon>
        <InputGroupInput placeholder="0" />
        <InputGroupAddon align="inline-end">
          <span className="h-3 w-px border-r" />
          <InputGroupButton size="icon-xs">
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

/**
 * A search input group.
 * Used with a search icon.
 */
export const SearchInput: Story = {
  render: () => (
    <InputGroup className="w-[300px]">
      <InputGroupAddon>
        <Search className="h-4 w-4" />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search products..." />
    </InputGroup>
  ),
};

/**
 * A URL input group.
 * Used with a URL prefix.
 */
export const UrlInput: Story = {
  render: () => (
    <InputGroup className="w-[400px]">
      <InputGroupAddon>
        <InputGroupText>https://</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="www.example.com" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton>
          <Copy className="h-4 w-4" />
          Copy
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};

/**
 * A password input group.
 * Includes a show/hide password toggle button.
 */
export const PasswordInput: Story = {
  render: function PasswordInputDemo() {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <InputGroup className="w-[300px]">
        <InputGroupInput
          type={showPassword ? "text" : "password"}
          placeholder="Enter password"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
  },
};

/**
 * An input group in the loading state.
 * Shows a loading indicator.
 */
export const WithLoading: Story = {
  render: () => (
    <InputGroup className="w-[300px]">
      <InputGroupInput placeholder="Loading data..." disabled />
      <InputGroupAddon align="inline-end">
        <LoaderIcon className="h-4 w-4 animate-spin" />
      </InputGroupAddon>
    </InputGroup>
  ),
};

/**
 * An input group with a dropdown menu.
 * Provides additional options.
 */
export const WithDropdown: Story = {
  render: () => (
    <InputGroup className="w-[300px]">
      <InputGroupInput placeholder="Select action..." />
      <InputGroupAddon align="inline-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <InputGroupButton size="icon-sm">
              <ChevronDownIcon className="h-4 w-4" />
            </InputGroupButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Copy</DropdownMenuItem>
            <DropdownMenuItem>Paste</DropdownMenuItem>
            <DropdownMenuItem>Cut</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </InputGroupAddon>
    </InputGroup>
  ),
};

/**
 * An input group with several buttons.
 * Provides several actions.
 */
export const WithMultipleButtons: Story = {
  render: () => (
    <InputGroup className="w-[400px]">
      <InputGroupInput placeholder="Enter text..." />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs">
          <Copy className="h-4 w-4" />
        </InputGroupButton>
        <Separator orientation="vertical" className="h-4" />
        <InputGroupButton size="icon-xs">
          <XIcon className="h-4 w-4" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};

/**
 * An input group with a Textarea.
 * Includes multi-line input and action buttons.
 */
export const WithTextarea: Story = {
  render: () => (
    <InputGroup className="w-[400px]">
      <InputGroupTextarea placeholder="Type your message..." rows={4} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs">
          <ArrowUpIcon className="h-4 w-4" />
        </InputGroupButton>
        <Kbd>⏎</Kbd>
      </InputGroupAddon>
    </InputGroup>
  ),
};

/**
 * An input group with block-aligned addons.
 * Places full-width addons at the top or bottom.
 */
export const WithBlockAddon: Story = {
  render: () => (
    <div className="w-[400px] space-y-4">
      <InputGroup>
        <InputGroupAddon align="block-start">
          <InputGroupText>Title</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="Enter title..." />
      </InputGroup>
      <InputGroup>
        <InputGroupInput placeholder="Enter description..." />
        <InputGroupAddon align="block-end">
          <InputGroupText className="text-muted-foreground">
            Maximum 100 characters
          </InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

/**
 * An input group with inline text.
 * Includes text inside the input field.
 */
export const WithInlineText: Story = {
  render: () => (
    <div className="w-[400px] space-y-4">
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>$</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="0.00" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>USD</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupInput placeholder="username" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>@example.com</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

/**
 * A numeric input group.
 * Includes increment/decrement buttons.
 */
export const NumberInput: Story = {
  render: function NumberInputDemo() {
    const [value, setValue] = React.useState("0");

    return (
      <InputGroup className="w-[200px]">
        <InputGroupAddon>
          <InputGroupButton
            size="icon-xs"
            onClick={() => setValue(String(Math.max(0, Number(value) - 1)))}
          >
            <XIcon className="h-4 w-4" />
          </InputGroupButton>
          <span className="h-3 w-px border-r" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-center"
        />
        <InputGroupAddon align="inline-end">
          <span className="h-3 w-px border-r" />
          <InputGroupButton
            size="icon-xs"
            onClick={() => setValue(String(Number(value) + 1))}
          >
            <PlusIcon className="h-4 w-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
  },
};

/**
 * An input group in the error state.
 * Indicates a validation failure.
 */
export const ErrorState: Story = {
  render: () => (
    <InputGroup className="w-[300px]">
      <InputGroupInput placeholder="Enter email..." aria-invalid="true" />
      <InputGroupAddon align="inline-end">
        <XIcon className="text-destructive h-4 w-4" />
      </InputGroupAddon>
    </InputGroup>
  ),
};

/**
 * A disabled input group.
 * All elements are disabled.
 */
export const DisabledState: Story = {
  render: () => (
    <InputGroup className="w-[300px]" data-disabled="true">
      <InputGroupAddon>
        <Search className="h-4 w-4" />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search..." disabled />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" disabled>
          <XIcon className="h-4 w-4" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};
