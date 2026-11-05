import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  BadgeCheckIcon,
  ChevronDown,
  ChevronRightIcon,
  Plus,
  PlusIcon,
  ShieldAlertIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

/**
 * A versatile component that you can use to display any content.
 * Provides flexible layout options for displaying various types of content with consistent styling.
 */
const meta = {
  title: "ui/Item",
  component: Item,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Item>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Basic Item usage.
 * Includes a title, description and action button.
 */
export const Default: Story = {
  render: () => (
    <div className="flex w-full max-w-md flex-col gap-6">
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Basic Item</ItemTitle>
          <ItemDescription>
            A simple item with title and description.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Action
          </Button>
        </ItemActions>
      </Item>
      <Item variant="outline" size="sm" asChild>
        <a href="#">
          <ItemMedia>
            <BadgeCheckIcon className="size-5" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Your profile has been verified.</ItemTitle>
          </ItemContent>
          <ItemActions>
            <ChevronRightIcon className="size-4" />
          </ItemActions>
        </a>
      </Item>
    </div>
  ),
};

/**
 * Variant example.
 * Shows the default and outline variants.
 */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Item>
        <ItemContent>
          <ItemTitle>Default Variant</ItemTitle>
          <ItemDescription>
            Standard styling with subtle background and borders.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </ItemActions>
      </Item>
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Outline Variant</ItemTitle>
          <ItemDescription>
            Bordered styling for better visual separation.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            View
          </Button>
        </ItemActions>
      </Item>
    </div>
  ),
};

/**
 * Size example.
 * Shows the sm and default sizes.
 */
export const Size: Story = {
  render: () => (
    <div className="flex w-full max-w-md flex-col gap-6">
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Default Size Item</ItemTitle>
          <ItemDescription>
            Standard size with comfortable padding.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Action
          </Button>
        </ItemActions>
      </Item>
      <Item variant="outline" size="sm" asChild>
        <a href="#">
          <ItemMedia>
            <BadgeCheckIcon className="size-5" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Small Size Item</ItemTitle>
          </ItemContent>
          <ItemActions>
            <ChevronRightIcon className="size-4" />
          </ItemActions>
        </a>
      </Item>
    </div>
  ),
};

/**
 * Icon example.
 * Shows an icon in ItemMedia.
 */
export const Icon: Story = {
  render: () => (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <Item variant="outline">
        <ItemMedia variant="icon">
          <ShieldAlertIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Security Alert</ItemTitle>
          <ItemDescription>
            New login detected from unknown device.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button size="sm" variant="outline">
            Review
          </Button>
        </ItemActions>
      </Item>
    </div>
  ),
};

/**
 * Avatar example.
 * Uses the Avatar component in ItemMedia.
 */
export const AvatarExample: Story = {
  render: () => (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <Item variant="outline">
        <ItemMedia>
          <Avatar>
            <AvatarImage src="https://github.com/evilrabbit.png" />
            <AvatarFallback>ER</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Evil Rabbit</ItemTitle>
          <ItemDescription>Last seen 5 months ago</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button size="icon-sm" variant="outline" className="rounded-full">
            <Plus />
          </Button>
        </ItemActions>
      </Item>
    </div>
  ),
};

/**
 * Image example.
 * Shows an image in ItemMedia.
 */
export const ImageExample: Story = {
  render: () => {
    const music = [
      {
        title: "Midnight City Lights",
        artist: "Neon Dreams",
        album: "Electric Nights",
        duration: "3:45",
      },
      {
        title: "Coffee Shop Conversations",
        artist: "The Morning Brew",
        album: "Urban Stories",
        duration: "4:05",
      },
      {
        title: "Digital Rain",
        artist: "Cyber Symphony",
        album: "Binary Beats",
        duration: "3:30",
      },
    ];

    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <ItemGroup className="gap-4">
          {music.map((song) => (
            <Item key={song.title} variant="outline" asChild role="listitem">
              <a href="#">
                <ItemMedia variant="image">
                  <Image
                    src={`https://avatar.vercel.sh/${song.title}`}
                    alt={song.title}
                    width={32}
                    height={32}
                    className="object-cover grayscale"
                  />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="line-clamp-1">
                    {song.title} -{" "}
                    <span className="text-muted-foreground">{song.album}</span>
                  </ItemTitle>
                  <ItemDescription>{song.artist}</ItemDescription>
                </ItemContent>
                <ItemContent className="flex-none text-center">
                  <ItemDescription>{song.duration}</ItemDescription>
                </ItemContent>
              </a>
            </Item>
          ))}
        </ItemGroup>
      </div>
    );
  },
};

/**
 * Group example.
 * Uses ItemGroup and ItemSeparator.
 */
export const Group: Story = {
  render: () => {
    const people = [
      {
        username: "shadcn",
        avatar: "https://github.com/shadcn.png",
        email: "shadcn@vercel.com",
      },
      {
        username: "maxleiter",
        avatar: "https://github.com/maxleiter.png",
        email: "maxleiter@vercel.com",
      },
      {
        username: "evilrabbit",
        avatar: "https://github.com/evilrabbit.png",
        email: "evilrabbit@vercel.com",
      },
    ];

    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <ItemGroup>
          {people.map((person, index) => (
            <React.Fragment key={person.username}>
              <Item>
                <ItemMedia>
                  <Avatar>
                    <AvatarImage src={person.avatar} className="grayscale" />
                    <AvatarFallback>{person.username.charAt(0)}</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent className="gap-1">
                  <ItemTitle>{person.username}</ItemTitle>
                  <ItemDescription>{person.email}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <PlusIcon className="size-4" />
                  </Button>
                </ItemActions>
              </Item>
              {index < people.length - 1 && <ItemSeparator />}
            </React.Fragment>
          ))}
        </ItemGroup>
      </div>
    );
  },
};

/**
 * Header example.
 * Uses ItemHeader to show an image at the top.
 */
export const Header: Story = {
  render: () => {
    const models = [
      {
        name: "claude-3-5-sonnet",
        image: "https://avatar.vercel.sh/claude-3-5-sonnet",
        lastUsed: "Just now",
        version: "20241022",
      },
      {
        name: "gpt-4o",
        image: "https://avatar.vercel.sh/gpt-4o",
        lastUsed: "2 hours ago",
        version: "2024-08-06",
      },
    ];

    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <ItemGroup className="gap-4">
          {models.map((model) => (
            <Item key={model.name} variant="outline">
              <ItemHeader>
                <Image
                  src={model.image}
                  alt={model.name}
                  width={128}
                  height={128}
                  className="aspect-square w-full rounded-sm object-cover"
                />
              </ItemHeader>
              <ItemContent>
                <ItemTitle>{model.name}</ItemTitle>
                <ItemDescription>Version: {model.version}</ItemDescription>
              </ItemContent>
              <ItemContent>
                <ItemDescription className="text-xs">
                  Last used {model.lastUsed}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      </div>
    );
  },
};

/**
 * Link example.
 * Uses the asChild prop to show various blog posts as links.
 */
export const LinkExample: Story = {
  render: () => {
    const posts = [
      {
        title: "Introducing AI-powered code reviews",
        description:
          "Revolutionize your development workflow with intelligent automation",
        date: "Dec 1, 2024",
        href: "#",
      },
      {
        title: "Best practices for React 19",
        description: "Essential patterns and tips for the latest React release",
        date: "Nov 28, 2024",
        href: "#",
      },
      {
        title: "Building scalable design systems",
        description:
          "A comprehensive guide to creating maintainable component libraries",
        date: "Nov 15, 2024",
        href: "#",
      },
    ];

    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <ItemGroup className="gap-4">
          {posts.map((post) => (
            <Item key={post.title} variant="outline" asChild>
              <Link href={post.href}>
                <ItemContent>
                  <ItemTitle>{post.title}</ItemTitle>
                  <ItemDescription>{post.description}</ItemDescription>
                </ItemContent>
                <ItemContent className="flex-none">
                  <ItemDescription className="text-xs">
                    {post.date}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRightIcon className="size-4" />
                </ItemActions>
              </Link>
            </Item>
          ))}
        </ItemGroup>
      </div>
    );
  },
};

/**
 * Dropdown example.
 * Used with DropdownMenu to show a list of people.
 */
export const Dropdown: Story = {
  render: () => {
    const [selected, setSelected] = React.useState("Select");
    const people = [
      {
        username: "shadcn",
        avatar: "https://github.com/shadcn.png",
        email: "shadcn@vercel.com",
      },
      {
        username: "maxleiter",
        avatar: "https://github.com/maxleiter.png",
        email: "maxleiter@vercel.com",
      },
      {
        username: "evilrabbit",
        avatar: "https://github.com/evilrabbit.png",
        email: "evilrabbit@vercel.com",
      },
    ];

    return (
      <div className="flex min-h-64 w-full max-w-md flex-col items-center gap-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-fit">
              {selected}
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-64">
            {people.map((person) => (
              <DropdownMenuItem
                key={person.username}
                onSelect={() => setSelected(person.username)}
              >
                <Item className="cursor-pointer">
                  <ItemMedia>
                    <Avatar>
                      <AvatarImage src={person.avatar} className="grayscale" />
                      <AvatarFallback>
                        {person.username.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </ItemMedia>
                  <ItemContent className="gap-1">
                    <ItemTitle>{person.username}</ItemTitle>
                    <ItemDescription>{person.email}</ItemDescription>
                  </ItemContent>
                </Item>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  },
};
