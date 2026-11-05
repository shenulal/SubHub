"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * 🎯 Purpose: OKLCH theme preview and design token visualization
 *
 * This story visually presents the OKLCH color system used in the project.
 * - OKLCH (Oklab Lightness Chroma Hue): a perceptually uniform color space
 * - Wider gamut (P3) support allows more vivid colors
 * - Browser compatibility: 93% (100% with the PostCSS fallback)
 * - Supports switching between Light and Dark modes
 */
const meta = {
  title: "design/Theme Preview",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Full theme preview using the OKLCH color system. Shows every design token and examples applied to real components.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 🎨 Full theme preview
 *
 * Visually displays every color token in the project.
 * Use the theme toggle at the top right to switch between Light and Dark modes.
 */
export const AllTokens: Story = {
  render: () => {
    const [theme, setTheme] = useState<"light" | "dark">("light");

    // 🎯 Purpose: Apply the theme class to the actual <html> element of the Storybook iframe
    // Manipulates document.documentElement instead of rendering <html>/<body> tags directly
    useEffect(() => {
      document.documentElement.className =
        theme === "dark" ? "theme-default-dark" : "theme-default-light";
    }, [theme]);

    return (
      <div className="relative space-y-8">
        {/* Theme Switcher Button */}
        <div className="absolute top-4 right-4 z-10">
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
                onClick={() => setTheme("light")}
                className={theme === "light" ? "bg-accent" : ""}
              >
                <Sun className="mr-2 h-4 w-4" />
                <span>Light</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme("dark")}
                className={theme === "dark" ? "bg-accent" : ""}
              >
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Color palette section */}
        <section>
          <h2 className="mb-4 text-2xl font-bold">Color Palette</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Background Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Background</CardTitle>
                <CardDescription>Background colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="bg-background h-10 w-10 rounded-md border" />
                  <code className="text-sm">--background</code>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-foreground h-10 w-10 rounded-md border" />
                  <code className="text-sm">--foreground</code>
                </div>
              </CardContent>
            </Card>

            {/* Card Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Card</CardTitle>
                <CardDescription>Card colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="bg-card h-10 w-10 rounded-md border" />
                  <code className="text-sm">--card</code>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-card-foreground h-10 w-10 rounded-md border" />
                  <code className="text-sm">--card-foreground</code>
                </div>
              </CardContent>
            </Card>

            {/* Primary Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Primary</CardTitle>
                <CardDescription>Primary colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="bg-primary h-10 w-10 rounded-md border" />
                  <code className="text-sm">--primary</code>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-primary-foreground h-10 w-10 rounded-md border" />
                  <code className="text-sm">--primary-foreground</code>
                </div>
              </CardContent>
            </Card>

            {/* Secondary Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Secondary</CardTitle>
                <CardDescription>Secondary colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="bg-secondary h-10 w-10 rounded-md border" />
                  <code className="text-sm">--secondary</code>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-secondary-foreground h-10 w-10 rounded-md border" />
                  <code className="text-sm">--secondary-foreground</code>
                </div>
              </CardContent>
            </Card>

            {/* Muted Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Muted</CardTitle>
                <CardDescription>Muted colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="bg-muted h-10 w-10 rounded-md border" />
                  <code className="text-sm">--muted</code>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-muted-foreground h-10 w-10 rounded-md border" />
                  <code className="text-sm">--muted-foreground</code>
                </div>
              </CardContent>
            </Card>

            {/* Accent Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Accent</CardTitle>
                <CardDescription>Accent colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="bg-accent h-10 w-10 rounded-md border" />
                  <code className="text-sm">--accent</code>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-accent-foreground h-10 w-10 rounded-md border" />
                  <code className="text-sm">--accent-foreground</code>
                </div>
              </CardContent>
            </Card>

            {/* Destructive Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Destructive</CardTitle>
                <CardDescription>Destructive colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="bg-destructive h-10 w-10 rounded-md border" />
                  <code className="text-sm">--destructive</code>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-destructive-foreground h-10 w-10 rounded-md border" />
                  <code className="text-sm">--destructive-foreground</code>
                </div>
              </CardContent>
            </Card>

            {/* Border & Input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Border & Input</CardTitle>
                <CardDescription>Border & input colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="border-border bg-background h-10 w-10 rounded-md border-2" />
                  <code className="text-sm">--border</code>
                </div>
                <div className="flex items-center gap-2">
                  <div className="border-input bg-background h-10 w-10 rounded-md border-2" />
                  <code className="text-sm">--input</code>
                </div>
              </CardContent>
            </Card>

            {/* Ring */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ring</CardTitle>
                <CardDescription>Focus ring color</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="bg-background ring-ring h-10 w-10 rounded-md border ring-2 ring-offset-2" />
                  <code className="text-sm">--ring</code>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Chart colors section */}
        <section>
          <h2 className="mb-4 text-2xl font-bold">Chart Colors</h2>
          <div className="grid gap-4 md:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-lg">Chart {i}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`h-20 w-full rounded-md border`}
                    style={{
                      backgroundColor: `var(--chart-${i})`,
                    }}
                  />
                  <code className="text-sm">--chart-{i}</code>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Examples applied to real components */}
        <section>
          <h2 className="mb-4 text-2xl font-bold">Component Examples</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Button Variants</CardTitle>
                <CardDescription>
                  The theme applied to various button styles
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Badge Variants</CardTitle>
                <CardDescription>
                  The theme applied to various badge styles
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="default">Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Card Example</CardTitle>
                <CardDescription>
                  The card component uses the background, card and border tokens
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  This card uses the <code>--card</code>,{" "}
                  <code>--card-foreground</code>, <code>--border</code> colors.
                </p>
              </CardContent>
              <CardFooter>
                <Button>Action</Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* OKLCH information */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>About the OKLCH Color System</CardTitle>
              <CardDescription>
                This project uses the OKLCH color space
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold">Benefits</h3>
                <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                  <li>Perceptually uniform colors (more natural than HSL)</li>
                  <li>More vivid colors with wider gamut (P3) support</li>
                  <li>The default color format in Tailwind CSS v4</li>
                  <li>Consistent control of lightness and chroma</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Browser Support</h3>
                <p className="text-muted-foreground text-sm">
                  Chrome 111+, Firefox 113+, Safari 15.4+ (93%)
                  <br />
                  100% support for older browsers via the PostCSS fallback
                  plugin
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Format</h3>
                <code className="bg-muted block rounded-md p-2 text-sm">
                  oklch(lightness chroma hue)
                  <br />
                  e.g. oklch(0.623 0.214 259.815)
                </code>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    );
  },
};

/**
 * 🎨 Color usage by component
 *
 * Shows how each shadcn/ui component uses the theme colors.
 * Use the theme toggle at the top right to switch between Light and Dark modes.
 */
export const ComponentShowcase: Story = {
  render: () => {
    const [theme, setTheme] = useState<"light" | "dark">("light");

    // 🎯 Purpose: Apply the theme class to the actual <html> element of the Storybook iframe
    // Manipulates document.documentElement instead of rendering <html>/<body> tags directly
    useEffect(() => {
      document.documentElement.className =
        theme === "dark" ? "theme-default-dark" : "theme-default-light";
    }, [theme]);

    return (
      <div className="relative space-y-6">
        {/* Theme Switcher Button */}
        <div className="absolute top-4 right-4 z-10">
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
                onClick={() => setTheme("light")}
                className={theme === "light" ? "bg-accent" : ""}
              >
                <Sun className="mr-2 h-4 w-4" />
                <span>Light</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme("dark")}
                className={theme === "dark" ? "bg-accent" : ""}
              >
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Component Showcase</h2>
        </div>

        {/* Primary Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Primary Actions</CardTitle>
            <CardDescription>
              Uses --primary and --primary-foreground
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button>Save</Button>
            <Button>Submit</Button>
            <Badge>New</Badge>
          </CardContent>
        </Card>

        {/* Secondary Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Secondary Actions</CardTitle>
            <CardDescription>
              Uses --secondary and --secondary-foreground
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="secondary">Cancel</Button>
            <Button variant="secondary">Back</Button>
            <Badge variant="secondary">Draft</Badge>
          </CardContent>
        </Card>

        {/* Destructive Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Destructive Actions</CardTitle>
            <CardDescription>
              Uses --destructive and --destructive-foreground
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="destructive">Delete</Button>
            <Button variant="destructive">Remove</Button>
            <Badge variant="destructive">Error</Badge>
          </CardContent>
        </Card>

        {/* Muted Elements */}
        <Card>
          <CardHeader>
            <CardTitle>Muted Elements</CardTitle>
            <CardDescription>
              Uses --muted and --muted-foreground
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              This is secondary text using the muted foreground color.
            </p>
            <div className="bg-muted mt-4 rounded-md p-4">
              <p className="text-sm">An area using the muted background</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  },
};
