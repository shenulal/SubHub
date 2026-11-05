"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ITEM = "gap-2.5 rounded-md px-3 py-2 text-[0.9375rem]";
const ITEM_ACTIVE =
  "bg-primary/[0.08] text-primary focus:bg-primary/[0.12] focus:text-primary [&_svg]:text-primary";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="테마 변경"
          className="text-foreground/80 hover:text-primary hover:bg-primary/10 data-[state=open]:bg-primary/10 data-[state=open]:text-primary relative rounded-full"
        >
          <Sun className="size-[22px] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-[22px] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">테마 변경</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40 p-1.5">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={cn(ITEM, theme === "light" && ITEM_ACTIVE)}
        >
          <Sun className="size-4" />
          라이트
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={cn(ITEM, theme === "dark" && ITEM_ACTIVE)}
        >
          <Moon className="size-4" />
          다크
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={cn(ITEM, theme === "system" && ITEM_ACTIVE)}
        >
          <span className="w-4 text-center">💻</span>
          시스템
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
