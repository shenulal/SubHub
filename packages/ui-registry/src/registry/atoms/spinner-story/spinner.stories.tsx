import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowUp as ArrowUpIcon, FileDown } from "lucide-react";

/**
 * Displays an animated loading indicator.
 * Used to communicate ongoing processes or data fetching.
 */
const meta = {
  title: "ui/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Basic usage.
 * Shows a real-world case such as payment processing.
 */
export const BasicUsage: Story = {
  render: () => (
    <div className="flex w-full max-w-xs flex-col gap-4 [--radius:1rem]">
      <Item variant="muted">
        <ItemMedia>
          <Spinner />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="line-clamp-1">Processing payment...</ItemTitle>
        </ItemContent>
        <ItemContent className="flex-none justify-end">
          <span className="text-sm tabular-nums">$100.00</span>
        </ItemContent>
      </Item>
    </div>
  ),
};

/**
 * Spinners in various sizes.
 * Available in sizes from size-3 to size-8.
 */
export const Size: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Spinner className="size-3" />
      <Spinner className="size-4" />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
    </div>
  ),
};

/**
 * Spinners in various colors.
 * Change the color with Tailwind text color classes.
 */
export const Color: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Spinner className="size-6 text-red-500" />
      <Spinner className="size-6 text-green-500" />
      <Spinner className="size-6 text-blue-500" />
      <Spinner className="size-6 text-yellow-500" />
      <Spinner className="size-6 text-purple-500" />
    </div>
  ),
};

/**
 * Button loading state.
 * Shows a spinner inside the button to indicate work in progress.
 */
export const ButtonLoading: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Button size="sm" disabled>
        <Spinner />
        Loading...
      </Button>
      <Button variant="outline" disabled>
        <Spinner />
        Please wait
      </Button>
      <Button variant="secondary" disabled>
        <Spinner />
        Processing
      </Button>
    </div>
  ),
};

/**
 * Badge loading state.
 * Shows a spinner inside the badge to indicate status.
 */
export const BadgeLoading: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>
        <Spinner />
        Syncing
      </Badge>
      <Badge variant="secondary">
        <Spinner />
        Updating
      </Badge>
      <Badge variant="outline">
        <Spinner />
        Processing
      </Badge>
    </div>
  ),
};

/**
 * Used with an input group.
 * Indicates validation or search in progress within the input field.
 */
export const InputGroupExample: Story = {
  render: () => (
    <div className="flex w-full max-w-md flex-col gap-4">
      <InputGroup>
        <InputGroupInput placeholder="Send a message..." disabled />
        <InputGroupAddon align="inline-end">
          <Spinner />
        </InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupTextarea placeholder="Send a message..." disabled />
        <InputGroupAddon align="block-end">
          <Spinner /> Validating...
          <InputGroupButton className="ml-auto" variant="default">
            <ArrowUpIcon />
            <span className="sr-only">Send</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

/**
 * Used in an empty state.
 * Used with the Empty component while content is loading.
 */
export const EmptyState: Story = {
  render: () => (
    <Empty className="w-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Spinner />
        </EmptyMedia>
        <EmptyTitle>Processing your request</EmptyTitle>
        <EmptyDescription>
          Please wait while we process your request. Do not refresh the page.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" disabled>
          Cancel
        </Button>
      </EmptyContent>
    </Empty>
  ),
};

/**
 * Item loading state.
 * Shows items that are downloading or processing.
 */
export const ItemLoading: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <Item>
        <ItemMedia variant="icon">
          <FileDown />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Report_Q4_2023.pdf</ItemTitle>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Spinner className="size-3" />
            Downloading...
          </div>
        </ItemContent>
      </Item>
    </div>
  ),
};
