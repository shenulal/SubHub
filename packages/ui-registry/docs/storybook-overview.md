# shadcn/ui Storybook Registry Architecture Document

> **Next-Generation UI Component System** - An interactive Storybook registry
> for shadcn/ui components

The shadcn/ui Storybook registry is an integrated system that documents and
distributes more than 60 UI components and design tokens.

## 📚 Project Overview

### 🎯 [System Introduction](https://github.com/lloydrichards/shadcn-storybook-registry)

**Seamless integration of shadcn/ui + Storybook + Registry**

- Component documentation system built with Storybook 9
- Supports installing stories through the shadcn CLI
- 95.2% component coverage (60/63)
- Next.js 15 + TypeScript + Tailwind CSS v4

### Usage

```bash
# Install an individual component story
npx shadcn@latest add @storybook/button-story

# Local testing
npx shadcn@latest add http://localhost:3000/v2/r/button-story.json
```

## 🏗️ Storybook Structure

### Directory Structure Based on Atomic Design

```
src/registry/
├── atoms/          # UI components (60)
├── tokens/         # Design tokens (6)
├── foundation/     # Foundation components (1)
└── templates/      # Template examples (1)
```

### Registry System

- **registry.json**: Manages metadata for all components
- **registryDependencies**: shadcn/ui component dependencies
- **dependencies**: External npm package dependencies
- **Automated build**: Generates JSON with `npm run registry:build`

## 🎨 Design Tokens

**Tailwind CSS v4 tokens based on the OKLCH colour system**

### ⚠️ Important: Design Token Usage Principles

**All components and templates must use the design tokens defined in
Storybook.**

- ❌ Do not use arbitrary values: `text-[28px]`, `h-[400px]`, `max-w-[1625px]`,
  etc.
- ✅ Use design tokens: `text-2xl`, `text-3xl`, `p-4`, `gap-6`, etc.
- For consistency and maintainability, avoid hard-coded values and use the
  standard tokens.

### Typography Tokens

- **Font Size**: `text-xs` (12px), `text-sm` (14px), `text-base` (16px),
  `text-lg` (18px), `text-xl` (20px), `text-2xl` (24px), `text-3xl` (30px),
  `text-4xl` (36px), `text-5xl` (48px), `text-6xl` (60px)
- **Font Weight**: `font-thin`, `font-light`, `font-normal`, `font-medium`,
  `font-semibold`, `font-bold`, `font-extrabold`
- **Letter Spacing**: `tracking-tighter`, `tracking-tight`, `tracking-normal`,
  `tracking-wide`, `tracking-wider`

### Spacing Tokens

- Uses the Tailwind standard system (1 unit = 4px)
- Examples: `p-1` (4px), `p-2` (8px), `p-3` (12px), `p-4` (16px), `p-6` (24px),
  `p-8` (32px), `p-12` (48px)

| Token                                                                                    | Description                           | Source Path                                                                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **[Color](./src/registry/tokens/color-story/color.stories.tsx)**                         | OKLCH colour palette and theme system | [`color.stories.tsx`](./src/registry/tokens/color-story/color.stories.tsx)                         |
| **[Typography](./src/registry/tokens/typography-story/typography.stories.tsx)**          | Typography scale and font system      | [`typography.stories.tsx`](./src/registry/tokens/typography-story/typography.stories.tsx)          |
| **[Spacing](./src/registry/tokens/spacing-story/spacing.stories.tsx)**                   | Spacing and margin token system       | [`spacing.stories.tsx`](./src/registry/tokens/spacing-story/spacing.stories.tsx)                   |
| **[Shadow](./src/registry/tokens/shadow-story/shadow.stories.tsx)**                      | Shadow effect tokens                  | [`shadow.stories.tsx`](./src/registry/tokens/shadow-story/shadow.stories.tsx)                      |
| **[Radius](./src/registry/tokens/radius-story/radius.stories.tsx)**                      | Border radius tokens                  | [`radius.stories.tsx`](./src/registry/tokens/radius-story/radius.stories.tsx)                      |
| **[Theme Preview](./src/registry/tokens/theme-preview-story/theme-preview.stories.tsx)** | Light/dark theme preview              | [`theme-preview.stories.tsx`](./src/registry/tokens/theme-preview-story/theme-preview.stories.tsx) |

## 🧩 UI Components

### Core Components (60)

#### Layout & Containers

| Component                                                                            | Description                       | Source                                                                                         | Key Props          |
| ------------------------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------ |
| **[Accordion](./src/registry/atoms/accordion-story/accordion.stories.tsx)**          | Collapsible content sections      | [`accordion.stories.tsx`](./src/registry/atoms/accordion-story/accordion.stories.tsx)          | type, collapsible  |
| **[Aspect Ratio](./src/registry/atoms/aspect-ratio-story/aspect-ratio.stories.tsx)** | Responsive aspect-ratio container | [`aspect-ratio.stories.tsx`](./src/registry/atoms/aspect-ratio-story/aspect-ratio.stories.tsx) | ratio              |
| **[Card](./src/registry/atoms/card-story/card.stories.tsx)**                         | Content card container            | [`card.stories.tsx`](./src/registry/atoms/card-story/card.stories.tsx)                         | className          |
| **[Collapsible](./src/registry/atoms/collapsible-story/collapsible.stories.tsx)**    | Collapsible content area          | [`collapsible.stories.tsx`](./src/registry/atoms/collapsible-story/collapsible.stories.tsx)    | open, onOpenChange |
| **[Resizable](./src/registry/atoms/resizable-story/resizable.stories.tsx)**          | Resizable panels                  | [`resizable.stories.tsx`](./src/registry/atoms/resizable-story/resizable.stories.tsx)          | direction          |
| **[Scroll Area](./src/registry/atoms/scroll-area-story/scroll-area.stories.tsx)**    | Custom scrollbar area             | [`scroll-area.stories.tsx`](./src/registry/atoms/scroll-area-story/scroll-area.stories.tsx)    | type               |
| **[Separator](./src/registry/atoms/separator-story/separator.stories.tsx)**          | Visual divider                    | [`separator.stories.tsx`](./src/registry/atoms/separator-story/separator.stories.tsx)          | orientation        |

#### Inputs & Forms

| Component                                                                            | Description                  | Source                                                                                         | Key Props                |
| ------------------------------------------------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------ |
| **[Button](./src/registry/atoms/button-story/button.stories.tsx)**                   | Buttons in a range of styles | [`button.stories.tsx`](./src/registry/atoms/button-story/button.stories.tsx)                   | variant, size            |
| **[Button Group](./src/registry/atoms/button-group-story/button-group.stories.tsx)** | Button group layout          | [`button-group.stories.tsx`](./src/registry/atoms/button-group-story/button-group.stories.tsx) | orientation              |
| **[Checkbox](./src/registry/atoms/checkbox-story/checkbox.stories.tsx)**             | Checkbox input               | [`checkbox.stories.tsx`](./src/registry/atoms/checkbox-story/checkbox.stories.tsx)             | checked, onCheckedChange |
| **[Field](./src/registry/atoms/field-story/field.stories.tsx)**                      | Form field container         | [`field.stories.tsx`](./src/registry/atoms/field-story/field.stories.tsx)                      | error, required          |
| **[Form](./src/registry/atoms/form-story/form.stories.tsx)**                         | React Hook Form integration  | [`form.stories.tsx`](./src/registry/atoms/form-story/form.stories.tsx)                         | schema, onSubmit         |
| **[Input](./src/registry/atoms/input-story/input.stories.tsx)**                      | Text input field             | [`input.stories.tsx`](./src/registry/atoms/input-story/input.stories.tsx)                      | type, placeholder        |
| **[Input Group](./src/registry/atoms/input-group-story/input-group.stories.tsx)**    | Input field group            | [`input-group.stories.tsx`](./src/registry/atoms/input-group-story/input-group.stories.tsx)    | addon                    |
| **[Input OTP](./src/registry/atoms/input-otp-story/input-otp.stories.tsx)**          | OTP input field              | [`input-otp.stories.tsx`](./src/registry/atoms/input-otp-story/input-otp.stories.tsx)          | length                   |
| **[Label](./src/registry/atoms/label-story/label.stories.tsx)**                      | Form label                   | [`label.stories.tsx`](./src/registry/atoms/label-story/label.stories.tsx)                      | htmlFor                  |
| **[Radio Group](./src/registry/atoms/radio-group-story/radio-group.stories.tsx)**    | Radio button group           | [`radio-group.stories.tsx`](./src/registry/atoms/radio-group-story/radio-group.stories.tsx)    | value, onValueChange     |
| **[Select](./src/registry/atoms/select-story/select.stories.tsx)**                   | Select dropdown              | [`select.stories.tsx`](./src/registry/atoms/select-story/select.stories.tsx)                   | value, onValueChange     |
| **[Slider](./src/registry/atoms/slider-story/slider.stories.tsx)**                   | Range slider                 | [`slider.stories.tsx`](./src/registry/atoms/slider-story/slider.stories.tsx)                   | min, max, step           |
| **[Switch](./src/registry/atoms/switch-story/switch.stories.tsx)**                   | Toggle switch                | [`switch.stories.tsx`](./src/registry/atoms/switch-story/switch.stories.tsx)                   | checked, onCheckedChange |
| **[Textarea](./src/registry/atoms/textarea-story/textarea.stories.tsx)**             | Multi-line text input        | [`textarea.stories.tsx`](./src/registry/atoms/textarea-story/textarea.stories.tsx)             | rows                     |
| **[Toggle](./src/registry/atoms/toggle-story/toggle.stories.tsx)**                   | Toggle button                | [`toggle.stories.tsx`](./src/registry/atoms/toggle-story/toggle.stories.tsx)                   | pressed, onPressedChange |
| **[Toggle Group](./src/registry/atoms/toggle-group-story/toggle-group.stories.tsx)** | Toggle button group          | [`toggle-group.stories.tsx`](./src/registry/atoms/toggle-group-story/toggle-group.stories.tsx) | type, value              |

#### Date & Time

| Component                                                                                                             | Description                   | Source                                                                                                                          | Key Props        |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **[Calendar](./src/registry/atoms/calendar-story/calendar.stories.tsx)**                                              | Date selection calendar       | [`calendar.stories.tsx`](./src/registry/atoms/calendar-story/calendar.stories.tsx)                                              | mode, selected   |
| **[Calendar Form](./src/registry/atoms/calendar-form-story/calendar-form.stories.tsx)**                               | Form-integrated calendar      | [`calendar-form.stories.tsx`](./src/registry/atoms/calendar-form-story/calendar-form.stories.tsx)                               | validation       |
| **[Date of Birth Picker](./src/registry/atoms/date-of-birth-picker-story/date-of-birth-picker.stories.tsx)**          | Date of birth picker          | [`date-of-birth-picker.stories.tsx`](./src/registry/atoms/date-of-birth-picker-story/date-of-birth-picker.stories.tsx)          | minYear, maxYear |
| **[Date Picker](./src/registry/atoms/date-picker-story/date-picker.stories.tsx)**                                     | Date picker                   | [`date-picker.stories.tsx`](./src/registry/atoms/date-picker-story/date-picker.stories.tsx)                                     | placeholder      |
| **[Date Time Picker](./src/registry/atoms/date-time-picker-story/date-time-picker.stories.tsx)**                      | Date/time picker              | [`date-time-picker.stories.tsx`](./src/registry/atoms/date-time-picker-story/date-time-picker.stories.tsx)                      | granularity      |
| **[Month Year Selector](./src/registry/atoms/month-year-selector-story/month-year-selector.stories.tsx)**             | Month/year selector           | [`month-year-selector.stories.tsx`](./src/registry/atoms/month-year-selector-story/month-year-selector.stories.tsx)             | defaultValue     |
| **[Natural Language Picker](./src/registry/atoms/natural-language-picker-story/natural-language-picker.stories.tsx)** | Natural-language date input   | [`natural-language-picker.stories.tsx`](./src/registry/atoms/natural-language-picker-story/natural-language-picker.stories.tsx) | placeholder      |
| **[Range Calendar](./src/registry/atoms/range-calendar-story/range-calendar.stories.tsx)**                            | Date range selection calendar | [`range-calendar.stories.tsx`](./src/registry/atoms/range-calendar-story/range-calendar.stories.tsx)                            | from, to         |

#### Navigation & Menus

| Component                                                                                     | Description           | Source                                                                                                  | Key Props    |
| --------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- | ------------ |
| **[Breadcrumb](./src/registry/atoms/breadcrumb-story/breadcrumb.stories.tsx)**                | Path navigation trail | [`breadcrumb.stories.tsx`](./src/registry/atoms/breadcrumb-story/breadcrumb.stories.tsx)                | separator    |
| **[Command](./src/registry/atoms/command-story/command.stories.tsx)**                         | Command palette       | [`command.stories.tsx`](./src/registry/atoms/command-story/command.stories.tsx)                         | open         |
| **[Context Menu](./src/registry/atoms/context-menu-story/context-menu.stories.tsx)**          | Right-click menu      | [`context-menu.stories.tsx`](./src/registry/atoms/context-menu-story/context-menu.stories.tsx)          | onOpenChange |
| **[Dropdown Menu](./src/registry/atoms/dropdown-menu-story/dropdown-menu.stories.tsx)**       | Dropdown menu         | [`dropdown-menu.stories.tsx`](./src/registry/atoms/dropdown-menu-story/dropdown-menu.stories.tsx)       | align        |
| **[Menubar](./src/registry/atoms/menubar-story/menubar.stories.tsx)**                         | Menu bar              | [`menubar.stories.tsx`](./src/registry/atoms/menubar-story/menubar.stories.tsx)                         | value        |
| **[Navigation Menu](./src/registry/atoms/navigation-menu-story/navigation-menu.stories.tsx)** | Navigation menu       | [`navigation-menu.stories.tsx`](./src/registry/atoms/navigation-menu-story/navigation-menu.stories.tsx) | orientation  |
| **[Pagination](./src/registry/atoms/pagination-story/pagination.stories.tsx)**                | Pagination            | [`pagination.stories.tsx`](./src/registry/atoms/pagination-story/pagination.stories.tsx)                | page, total  |
| **[Sidebar](./src/registry/atoms/sidebar-story/sidebar.stories.tsx)**                         | Sidebar layout        | [`sidebar.stories.tsx`](./src/registry/atoms/sidebar-story/sidebar.stories.tsx)                         | collapsible  |
| **[Tabs](./src/registry/atoms/tabs-story/tabs.stories.tsx)**                                  | Tab navigation        | [`tabs.stories.tsx`](./src/registry/atoms/tabs-story/tabs.stories.tsx)                                  | defaultValue |

#### Feedback & Overlays

| Component                                                                            | Description            | Source                                                                                         | Key Props          |
| ------------------------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------ |
| **[Alert](./src/registry/atoms/alert-story/alert.stories.tsx)**                      | Alert message          | [`alert.stories.tsx`](./src/registry/atoms/alert-story/alert.stories.tsx)                      | variant            |
| **[Alert Dialog](./src/registry/atoms/alert-dialog-story/alert-dialog.stories.tsx)** | Confirmation dialog    | [`alert-dialog.stories.tsx`](./src/registry/atoms/alert-dialog-story/alert-dialog.stories.tsx) | open               |
| **[Badge](./src/registry/atoms/badge-story/badge.stories.tsx)**                      | Status badge           | [`badge.stories.tsx`](./src/registry/atoms/badge-story/badge.stories.tsx)                      | variant            |
| **[Dialog](./src/registry/atoms/dialog-story/dialog.stories.tsx)**                   | Modal dialog           | [`dialog.stories.tsx`](./src/registry/atoms/dialog-story/dialog.stories.tsx)                   | open, onOpenChange |
| **[Drawer](./src/registry/atoms/drawer-story/drawer.stories.tsx)**                   | Slide-in panel         | [`drawer.stories.tsx`](./src/registry/atoms/drawer-story/drawer.stories.tsx)                   | position           |
| **[Empty](./src/registry/atoms/empty-story/empty.stories.tsx)**                      | Empty state display    | [`empty.stories.tsx`](./src/registry/atoms/empty-story/empty.stories.tsx)                      | icon, title        |
| **[Hover Card](./src/registry/atoms/hover-card-story/hover-card.stories.tsx)**       | Hover information card | [`hover-card.stories.tsx`](./src/registry/atoms/hover-card-story/hover-card.stories.tsx)       | openDelay          |
| **[Popover](./src/registry/atoms/popover-story/popover.stories.tsx)**                | Popover                | [`popover.stories.tsx`](./src/registry/atoms/popover-story/popover.stories.tsx)                | align, side        |
| **[Progress](./src/registry/atoms/progress-story/progress.stories.tsx)**             | Progress indicator     | [`progress.stories.tsx`](./src/registry/atoms/progress-story/progress.stories.tsx)             | value              |
| **[Sheet](./src/registry/atoms/sheet-story/sheet.stories.tsx)**                      | Slide-over panel       | [`sheet.stories.tsx`](./src/registry/atoms/sheet-story/sheet.stories.tsx)                      | side               |
| **[Skeleton](./src/registry/atoms/skeleton-story/skeleton.stories.tsx)**             | Loading skeleton       | [`skeleton.stories.tsx`](./src/registry/atoms/skeleton-story/skeleton.stories.tsx)             | className          |
| **[Sonner](./src/registry/atoms/sonner-story/sonner.stories.tsx)**                   | Toast notifications    | [`sonner.stories.tsx`](./src/registry/atoms/sonner-story/sonner.stories.tsx)                   | position           |
| **[Spinner](./src/registry/atoms/spinner-story/spinner.stories.tsx)**                | Loading spinner        | [`spinner.stories.tsx`](./src/registry/atoms/spinner-story/spinner.stories.tsx)                | size               |
| **[Tooltip](./src/registry/atoms/tooltip-story/tooltip.stories.tsx)**                | Tooltip                | [`tooltip.stories.tsx`](./src/registry/atoms/tooltip-story/tooltip.stories.tsx)                | delayDuration      |

#### Data & Miscellaneous

| Component                                                                      | Description                  | Source                                                                                   | Key Props     |
| ------------------------------------------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------- | ------------- |
| **[Avatar](./src/registry/atoms/avatar-story/avatar.stories.tsx)**             | User avatar                  | [`avatar.stories.tsx`](./src/registry/atoms/avatar-story/avatar.stories.tsx)             | fallback      |
| **[Carousel](./src/registry/atoms/carousel-story/carousel.stories.tsx)**       | Image carousel               | [`carousel.stories.tsx`](./src/registry/atoms/carousel-story/carousel.stories.tsx)       | orientation   |
| **[Combobox](./src/registry/atoms/combobox-story/combobox.stories.tsx)**       | Autocomplete selector        | [`combobox.stories.tsx`](./src/registry/atoms/combobox-story/combobox.stories.tsx)       | placeholder   |
| **[Data Table](./src/registry/atoms/data-table-story/data-table.stories.tsx)** | Advanced data table          | [`data-table.stories.tsx`](./src/registry/atoms/data-table-story/data-table.stories.tsx) | columns, data |
| **[Item](./src/registry/atoms/item-story/item.stories.tsx)**                   | Multi-purpose item component | [`item.stories.tsx`](./src/registry/atoms/item-story/item.stories.tsx)                   | variant, size |
| **[Kbd](./src/registry/atoms/kbd-story/kbd.stories.tsx)**                      | Keyboard shortcut display    | [`kbd.stories.tsx`](./src/registry/atoms/kbd-story/kbd.stories.tsx)                      | keys          |
| **[Table](./src/registry/atoms/table-story/table.stories.tsx)**                | Basic table                  | [`table.stories.tsx`](./src/registry/atoms/table-story/table.stories.tsx)                | className     |

## 📊 Chart Components

**Interactive chart components built on Recharts (5)**

| Chart Type                                                                         | Description | Source                                                                                        | Key Variants                   |
| ---------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- | ------------------------------ |
| **[Area Chart](./src/registry/atoms/area-chart-story/area-charts.stories.tsx)**    | Area chart  | [`area-charts.stories.tsx`](./src/registry/atoms/area-chart-story/area-charts.stories.tsx)    | stacked, gradient, interactive |
| **[Bar Chart](./src/registry/atoms/bar-chart-story/bar-charts.stories.tsx)**       | Bar chart   | [`bar-charts.stories.tsx`](./src/registry/atoms/bar-chart-story/bar-charts.stories.tsx)       | horizontal, stacked, mixed     |
| **[Line Chart](./src/registry/atoms/line-chart-story/line-charts.stories.tsx)**    | Line chart  | [`line-charts.stories.tsx`](./src/registry/atoms/line-chart-story/line-charts.stories.tsx)    | dots, multiple, step           |
| **[Pie Chart](./src/registry/atoms/pie-chart-story/pie-charts.stories.tsx)**       | Pie chart   | [`pie-charts.stories.tsx`](./src/registry/atoms/pie-chart-story/pie-charts.stories.tsx)       | donut, label, interactive      |
| **[Radar Chart](./src/registry/atoms/radar-chart-story/radar-charts.stories.tsx)** | Radar chart | [`radar-charts.stories.tsx`](./src/registry/atoms/radar-chart-story/radar-charts.stories.tsx) | grid styles, legend            |

## 🏛️ Foundation Components

| Component                                                                                                 | Description                                       | Source                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **[Typography Components](./src/registry/foundation/typography-components-story/typography.stories.tsx)** | Typography components for consistent text styling | [`typography.stories.tsx`](./src/registry/foundation/typography-components-story/typography.stories.tsx) |

## 📋 Templates

| Template                                                                                             | Description                                                         | Source                                                                                                         | Included Components                               |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **[Dashboard Template](./src/registry/templates/dashboard-template/dashboard-template.stories.tsx)** | A complete dashboard template using a range of shadcn/ui components | [`dashboard-template.stories.tsx`](./src/registry/templates/dashboard-template/dashboard-template.stories.tsx) | card, select, button, input, avatar, table, badge |

## 🔧 Technology Stack

### Frameworks & Libraries

- **Next.js 15**: React framework (Turbopack support)
- **React 19**: UI library
- **TypeScript**: Type safety
- **Storybook 9**: Component documentation (Vite builder)
- **Tailwind CSS v4**: Utility-first CSS (design token support)

### Testing & Quality

- **Vitest**: Dual-project setup (unit + Storybook browser tests)
- **Playwright**: Storybook integration tests
- **ESLint & Prettier**: Code quality and formatting
- **Semantic Release**: Automated version management

### Key Dependencies

- **Radix UI**: Accessibility-compliant headless components
- **Recharts**: Chart library
- **React Hook Form + Zod**: Form management and validation
- **lucide-react**: Icon library
- **date-fns**: Date utilities

## 📈 Project Status

### Implementation Statistics

- **Total registry items**: 75
- **UI components**: 60 (95.2% coverage)
- **Design tokens**: 6
- **Chart components**: 5
- **Foundation**: 1
- **Templates**: 1
- **Utilities**: 1 (all-stories)

### Distribution by Category

```
atoms (UI)     ████████████████████ 60
tokens         ██ 6
charts         ██ 5
foundation     ▌ 1
templates      ▌ 1
utility        ▌ 1
```

### Recently Added Components

- Button Group - Button group layout
- Empty - Empty state display
- Field - Form field container
- Input Group - Input field group
- Item - Multi-purpose item component
- Kbd - Keyboard shortcut display
- Spinner - Loading spinner

## 🔗 Related Documents

- **[Design system](../../../docs/DESIGN-SYSTEM.md)** - SubHub's Materio design
  rules
- **[Playwright MCP testing](./guide/playwright-mcp-testing.md)** - Browser
  testing guide

## 📝 Quick Reference

### Development Commands

```bash
# Development server
npm run dev          # Next.js (Turbopack)
npm run storybook    # Storybook (port 6006)

# Build
npm run build        # Full build
npm run registry:build # Generate registry JSON

# Test
npm run test         # All tests
npm run test:unit    # Unit tests
npm run test:storybook # Storybook tests
```

### Component Addition Workflow

1. Create the `src/registry/atoms/[component-name]/` directory
2. Write the `[component].stories.tsx` file
3. Add metadata to `registry.json`
4. Run `npm run registry:build`
5. Test locally, then commit

---

_This document is a comprehensive architecture guide to the shadcn/ui Storybook
Registry. You can view the source code directly via each component link, and it
is designed so that an LLM can quickly understand and navigate the project
structure._

**📅 Last updated**: 15 January 2025  
**📝 Document version**: v1.0  
**🔄 Next update**: When new components are added
