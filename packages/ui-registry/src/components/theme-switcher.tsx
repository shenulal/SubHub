"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

// Storybook globals hook types
type GlobalsUpdate = Record<string, string>;
type UseGlobalsReturn = [GlobalsUpdate, (globals: GlobalsUpdate) => void];
type UseGlobalsHook = () => UseGlobalsReturn;

// Storybook globals hook (only available in Storybook environment)
let useGlobals: UseGlobalsHook | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useGlobals = require("@storybook/preview-api").useGlobals as UseGlobalsHook;
} catch {
  // Not in Storybook environment
}

/**
 * 🎯 Purpose: UI component for switching between light and dark themes
 * - Storybook: controls globals.theme directly (theme-default-light ↔ theme-default-dark)
 * - Next.js: manages theme state with next-themes
 * - Offers Light, Dark and System options in a dropdown menu
 * - Shows the icon dynamically based on the current theme
 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Storybook globals (if available)
  const storybookGlobals = useGlobals?.();
  const isStorybook = !!storybookGlobals;

  // 🎯 Purpose: Track mount state to prevent hydration mismatches
  // Render the theme UI on the client side only
  useEffect(() => {
    setMounted(true);
  }, []);

  // Return a placeholder during server-side rendering
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Sun className="h-5 w-5" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  // Determine the current theme in Storybook
  const getCurrentMode = () => {
    if (isStorybook && storybookGlobals) {
      const [globals] = storybookGlobals;
      const currentTheme = globals.theme || "blue-light";
      return currentTheme.includes("-dark") ? "dark" : "light";
    }
    return theme || "light";
  };

  // Switch the theme in Storybook
  const handleThemeChange = (mode: "light" | "dark" | "system") => {
    if (isStorybook && storybookGlobals) {
      const [globals, updateGlobals] = storybookGlobals;
      const currentTheme = globals.theme || "blue-light";

      // Extract color prefix (e.g., "blue" from "blue-light")
      const colorPrefix = currentTheme.split("-")[0];

      if (mode === "light") {
        updateGlobals({ theme: `${colorPrefix}-light` });
      } else if (mode === "dark") {
        updateGlobals({ theme: `${colorPrefix}-dark` });
      }
      // "system" is not supported in Storybook
    } else {
      // Use next-themes in Next.js
      setTheme(mode);
    }
  };

  const currentMode = getCurrentMode();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-5 w-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-5 w-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleThemeChange("light")}
          className={currentMode === "light" ? "bg-accent" : ""}
        >
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleThemeChange("dark")}
          className={currentMode === "dark" ? "bg-accent" : ""}
        >
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        {!isStorybook && (
          <DropdownMenuItem
            onClick={() => handleThemeChange("system")}
            className={currentMode === "system" ? "bg-accent" : ""}
          >
            <Sun className="mr-2 h-4 w-4" />
            <span>System</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
