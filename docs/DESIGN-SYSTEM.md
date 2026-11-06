# SubHub design system — Materio

SubHub's UI follows the **Materio** admin template
([themeselection/materio-mui-nextjs-admin-template-free](https://github.com/themeselection/materio-mui-nextjs-admin-template-free), MIT — see `public/images/materio/LICENSE`).
Materio is built on MUI; SubHub keeps its shadcn/ui + Tailwind 4 component layer and carries Materio's
design language onto it, so no form, table or workflow had to be rewritten.

## Where things live

| Layer                                                                                             | File(s)                                                |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Tokens (palette, text-opacity scale, dividers, shadows, radius, dark theme)                       | `src/app/globals.css`                                  |
| Helper utilities: `tonal-primary/success/warning/info/error/neutral`, `nav-active`, `kpi-value`   | `src/app/globals.css` (`@utility`)                     |
| Primitives (Button, Card, Badge, Input, Select, Tabs, Table, Dialog, Menu, Switch, Tooltip, OTP)  | `packages/ui-registry/src/components/ui/*`             |
| Shell: 260px vertical nav, floating navbar, 1440px content column, footer                         | `src/components/layouts/*`                             |
| Brand mark                                                                                        | `src/components/brand/subhub-logo.tsx`                 |
| Auth screens (centred 450px card, mask wave, trees)                                               | `src/app/(auth)/layout.tsx`, `public/images/materio/*` |
| Module sub-navigation (pill bar below 1280px, left column from 1280px; Subscriptions from 1536px) | `*-sidebar.tsx` + module `layout.tsx` files            |

## Rules for new UI

- **Colour:** primary `#8C57FF`; semantic `success #56CA00`, `warning #FFB400`, `info #16B1FF`, `error #FF4C51`. Use tokens (`bg-primary`, `text-muted-foreground`, `tonal-*`), never hex or Tailwind palette classes, so dark mode keeps working.
- **Type:** Inter (Google Fonts, variable font with optical sizing, loaded by `next/font` in `src/app/layout.tsx`). One family, several roles:

  | Role                                | Size           | Weight                                    | Class                                    |
  | ----------------------------------- | -------------- | ----------------------------------------- | ---------------------------------------- |
  | KPI figure                          | 20–28px fluid  | Bold 700, tracking −0.02em                | `kpi-value`                              |
  | Page title                          | 24px           | SemiBold 600, tracking −0.019em           | `text-2xl` on `h1`                       |
  | Section / card / dialog title       | 18px           | SemiBold 600                              | `text-lg` (titles are forced to 600)     |
  | Body                                | 15px           | Regular 400                               | default                                  |
  | Labels, buttons, nav, table headers | 13–15px        | Medium 500                                | `font-medium`                            |
  | Secondary text                      | 13px           | Regular 400, muted                        | `text-[0.8125rem] text-muted-foreground` |
  | Caption / overline                  | 12px (minimum) | Medium 500, overline uppercase + tracking | `text-xs`                                |

  Weight utilities are Tailwind's real values (`font-medium` 500, `font-semibold` 600, `font-bold` 700). Character variants `cv05`/`cv08` keep l, I and 1 distinct in codes and tables; tables and KPIs use tabular figures.

- **Surfaces:** `Card` is the only shadowed surface (6px radius, `shadow-md`, 20px padding). Panels inside a card are outlined (`rounded-md border`) or `bg-muted`.
- **Chips:** `Badge` variants `success | warning | info | primary | error | neutral` (tonal), plus `default | secondary | outline | destructive`.
- **Statistic cards:** tonal icon tile → title (13px, truncate) → value (`kpi-value` or `text-2xl font-medium tabular-nums truncate` with `title`) → caption.
- **No wrapping or overflow:** buttons, tabs and chips are single-line (`white-space: nowrap` globally); every flex/grid child holding text gets `min-w-0`; long values use `truncate` + `title`; tables scroll inside their own container, never the page.
- **Spacing:** `gap-6` between cards, `gap-4` inside them; content column max 1440px with 24px gutters.

## Pickers and quick create

- Pickers of master data offer **inline creation** for users with the manage permission: `SelectContent createOption`,
  `MultiSelect createOption`, or the hooks in `src/components/common/quick-create/use-inline-create.tsx` (teams, invites).
  New records are added to the list and selected; the server action re-checks the permission.
- Master-data dropdowns end with `<ManageMasterLink>` ("Manage …" → `/settings/masters?tab=…`, manage permission only).
- Apps are created with `CreateAppDialog` (`apps:manage`). The navbar "+ New" menu (shortcut **N**) and the ⌘K palette
  list every quick-create entry from `quick-create-registry.ts`, filtered by permission.
- Long forms keep the primary action in a sticky footer (`FormActionBar`); destructive actions go through `ConfirmAction`.
- Activity and audit texts use `describeAuditAction()` (`src/lib/audit/describe-action.ts`) — never show raw action codes.

## Visual check

Layout regressions are checked with a Playwright script that reports page-level horizontal scroll,
clipped text, multi-line buttons and content spilling out of cards at 1440 / 1024 / 390 px. At release
(2026-11-05) all main routes reported zero issues at 1440 and 1024 on the production build.
