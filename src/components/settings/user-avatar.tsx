// src/components/settings/user-avatar.tsx
"use client";

import Avatar from "boring-avatars";

// Brand colour palette (5 colours)
const AVATAR_COLORS = ["#0a0310", "#49007e", "#ff005b", "#ff7d10", "#ffb238"];

// Available avatar variants
type AvatarVariant =
  | "marble"
  | "beam"
  | "pixel"
  | "sunset"
  | "ring"
  | "bauhaus";

interface UserAvatarProps {
  /** Avatar seed (email or unique identifier) */
  name: string;
  /** Avatar size (pixels) */
  size?: number;
  /** Avatar variant style */
  variant?: AvatarVariant;
  /** Custom colour palette (5 colours) */
  colors?: string[];
}

/**
 * Random avatar component built on the boring-avatars library
 * - Always generates the same avatar for the same name (deterministic)
 * - Supports multiple style variants
 */
export function UserAvatar({
  name,
  size = 40,
  variant = "beam",
  colors = AVATAR_COLORS,
}: UserAvatarProps) {
  return (
    <Avatar
      name={name}
      size={size}
      variant={variant}
      colors={colors}
      square={false}
    />
  );
}

/**
 * Avatar preview component (shows every variant)
 */
export function AvatarPreviewGrid({
  name,
  size = 48,
  onSelect,
  selectedVariant,
}: {
  name: string;
  size?: number;
  onSelect?: (variant: AvatarVariant) => void;
  selectedVariant?: AvatarVariant;
}) {
  const variants: AvatarVariant[] = [
    "beam",
    "marble",
    "pixel",
    "sunset",
    "ring",
    "bauhaus",
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {variants.map((variant) => (
        <button
          key={variant}
          type="button"
          onClick={() => onSelect?.(variant)}
          className={`rounded-full p-1 transition-all hover:scale-110 ${
            selectedVariant === variant
              ? "ring-primary ring-2 ring-offset-2"
              : "hover:ring-muted-foreground ring-1 ring-transparent hover:ring-2"
          }`}
          title={variant}
        >
          <UserAvatar name={name} size={size} variant={variant} />
        </button>
      ))}
    </div>
  );
}

export { AVATAR_COLORS, type AvatarVariant };
