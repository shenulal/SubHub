"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

// 다크 모드 미리보기 색상
// (Materio dark palette: paper #312D4B, text #E7E3FC, primary #8C57FF)
const darkColors = {
  background: "#312d4b",
  foreground: "#e7e3fc",
  primary: "#8c57ff",
  muted: "#3d3759",
  mutedForeground: "#aaa5c4",
  border: "#4a4466",
};

// 라이트 모드 미리보기 색상
// (Materio light palette: paper #FFFFFF, text #2E263D, primary #8C57FF)
const lightColors = {
  background: "#ffffff",
  foreground: "#2e263d",
  primary: "#8c57ff",
  muted: "#f4f5fa",
  mutedForeground: "#8a8595",
  border: "#e6e5e8",
};

export function AppearanceSettingsClient() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const themes = useMemo(
    () => [
      {
        id: "light",
        label: t("settings.appearance.themes.light.title"),
        description: t("settings.appearance.themes.light.description"),
        icon: Sun,
      },
      {
        id: "dark",
        label: t("settings.appearance.themes.dark.title"),
        description: t("settings.appearance.themes.dark.description"),
        icon: Moon,
      },
      {
        id: "system",
        label: t("settings.appearance.themes.system.title"),
        description: t("settings.appearance.themes.system.description"),
        icon: Monitor,
      },
    ],
    [t]
  );

  // 선택한 테마에 따른 미리보기 색상 결정
  const previewColors = useMemo(() => {
    let previewTheme = theme;
    if (theme === "system" && typeof window !== "undefined") {
      previewTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return previewTheme === "dark" ? darkColors : lightColors;
  }, [theme]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="bg-muted h-4 w-20 rounded" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-muted h-32 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex min-w-0 items-center gap-4 border-b pb-5">
        <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
          <Palette className="size-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="text-foreground text-lg leading-snug font-medium">
            {t("settings.appearance.title")}
          </h3>
          <p className="text-muted-foreground text-[0.8125rem]">
            {t("settings.appearance.description")}
          </p>
        </div>
      </div>

      {/* Theme Selection */}
      <div className="grid gap-5 sm:grid-cols-3">
        {themes.map((themeOption) => {
          const Icon = themeOption.icon;
          const isSelected = theme === themeOption.id;

          return (
            <button
              key={themeOption.id}
              type="button"
              onClick={() => setTheme(themeOption.id)}
              className={cn(
                "focus-visible:ring-primary/20 relative flex min-w-0 flex-col items-center gap-3 rounded-md border-2 p-5 whitespace-normal transition-colors outline-none focus-visible:ring-[3px]",
                isSelected
                  ? "border-primary bg-primary/[0.06]"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div
                className={cn(
                  "flex size-12 items-center justify-center rounded-md",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "tonal-neutral"
                )}
              >
                <Icon className="size-6" />
              </div>
              <div className="min-w-0 space-y-0.5 text-center">
                <p className="text-foreground font-medium">
                  {themeOption.label}
                </p>
                <p className="text-muted-foreground text-[0.8125rem]">
                  {themeOption.description}
                </p>
              </div>
              {isSelected && (
                <div className="bg-primary absolute top-3 right-3 size-2 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* 테마 미리보기 - 선택한 테마에 따라 색상 변경 */}
      <div className="space-y-4">
        <Label className="text-[0.9375rem] font-medium">
          {t("settings.appearance.preview")}
        </Label>
        <div
          className="rounded-md border p-5 shadow-xs transition-colors"
          style={{
            backgroundColor: previewColors.background,
            borderColor: previewColors.border,
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-full"
                style={{ backgroundColor: previewColors.primary }}
              />
              <div className="space-y-1">
                <div
                  className="h-3 w-24 rounded"
                  style={{ backgroundColor: previewColors.foreground }}
                />
                <div
                  className="h-2 w-32 rounded"
                  style={{ backgroundColor: previewColors.mutedForeground }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div
                className="h-8 w-20 rounded-md"
                style={{ backgroundColor: previewColors.primary }}
              />
              <div
                className="h-8 w-20 rounded-md"
                style={{
                  backgroundColor: previewColors.background,
                  border: `1px solid ${previewColors.border}`,
                }}
              />
            </div>
            <div className="space-y-2">
              <div
                className="h-2 w-full rounded"
                style={{ backgroundColor: previewColors.muted }}
              />
              <div
                className="h-2 w-3/4 rounded"
                style={{ backgroundColor: previewColors.muted }}
              />
              <div
                className="h-2 w-1/2 rounded"
                style={{ backgroundColor: previewColors.muted }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
