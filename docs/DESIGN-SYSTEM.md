# SubHub design system — Materio

SubHub's UI follows the **Materio** admin template
([themeselection/materio-mui-nextjs-admin-template-free](https://github.com/themeselection/materio-mui-nextjs-admin-template-free), MIT — see `public/images/materio/LICENSE`).
Materio is built on MUI; SubHub keeps its shadcn/ui + Tailwind 4 component layer and carries Materio's
design language onto it, so no form, table or workflow had to be rewritten.

## Where things live

| Layer                                                                                            | File(s)                                                |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Tokens (palette, text-opacity scale, dividers, shadows, radius, dark theme)                      | `src/app/globals.css`                                  |
| Helper utilities: `tonal-primary/success/warning/info/error/neutral`, `nav-active`, `kpi-value`  | `src/app/globals.css` (`@utility`)                     |
| Primitives (Button, Card, Badge, Input, Select, Tabs, Table, Dialog, Menu, Switch, Tooltip, OTP) | `packages/ui-registry/src/components/ui/*`             |
| Shell: 260px vertical nav, floating navbar, 1440px content column, footer                        | `src/components/layouts/*`                             |
| Brand mark                                                                                       | `src/components/brand/subhub-logo.tsx`                 |
| Auth screens (centred 450px card, mask wave, trees)                                              | `src/app/(auth)/layout.tsx`, `public/images/materio/*` |
| Module sub-navigation (pill bar below 1280px, left column from 1280px)                           | `*-sidebar.tsx` + module `layout.tsx` files            |

## Rules for new UI

- **Colour:** primary `#8C57FF`; semantic `success #56CA00`, `warning #FFB400`, `info #16B1FF`, `error #FF4C51`. Use tokens (`bg-primary`, `text-muted-foreground`, `tonal-*`), never hex or Tailwind palette classes, so dark mode keeps working.
- **Type:** Inter. Page title `text-2xl font-medium`, card title `text-lg font-medium`, body 15px, captions 13px muted. Headings use weight 500.
- **Surfaces:** `Card` is the only shadowed surface (6px radius, `shadow-md`, 20px padding). Panels inside a card are outlined (`rounded-md border`) or `bg-muted`.
- **Chips:** `Badge` variants `success | warning | info | primary | error | neutral` (tonal), plus `default | secondary | outline | destructive`.
- **Statistic cards:** tonal icon tile → title (13px, truncate) → value (`kpi-value` or `text-2xl font-medium tabular-nums truncate` with `title`) → caption.
- **No wrapping or overflow:** buttons, tabs and chips are single-line (`white-space: nowrap` globally); every flex/grid child holding text gets `min-w-0`; long values use `truncate` + `title`; tables scroll inside their own container, never the page.
- **Spacing:** `gap-6` between cards, `gap-4` inside them; content column max 1440px with 24px gutters.

## Visual check

Layout regressions are checked with a Playwright script that reports page-level horizontal scroll,
clipped text, multi-line buttons and content spilling out of cards at 1440 / 1024 / 390 px. At release
(2026-11-05) all main routes reported zero issues at 1440 and 1024 on the production build.
