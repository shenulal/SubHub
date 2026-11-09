"use client";

// src/components/super-admin/analytics/top-apps-card.tsx
/** Top apps by spend (and, platform-wide, by number of organisations using them). */
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TopApp } from "@/types/platform-analytics";
import { AppWindow } from "lucide-react";
import { useState } from "react";

import { money } from "./analytics-format";
import { ChartCard } from "./chart-card";
import { RankedList } from "./ranked-list";

type Mode = "spend" | "adoption";

const ITEM_CLASSES =
  "text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-primary h-7 shrink-0 rounded-sm px-3 text-xs whitespace-nowrap data-[state=on]:font-medium data-[state=on]:shadow-xs";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function toItems(apps: TopApp[], mode: Mode, currency: string) {
  return apps.map((app) => ({
    key: app.key,
    label: app.name,
    value: mode === "spend" ? app.monthly : app.organizations,
    display:
      mode === "spend"
        ? money(app.monthly, currency)
        : plural(app.organizations, "org"),
    hint:
      mode === "spend"
        ? plural(app.organizations, "org")
        : money(app.monthly, currency),
  }));
}

interface TopAppsCardProps {
  bySpend: TopApp[];
  /** Platform view only: ranking by organisations using the app. */
  byAdoption?: TopApp[];
  currency: string;
  /** Organisation view: hide the organisation count hint. */
  singleOrganization?: boolean;
}

export function TopAppsCard({
  bySpend,
  byAdoption,
  currency,
  singleOrganization,
}: TopAppsCardProps) {
  const [mode, setMode] = useState<Mode>("spend");
  const apps = mode === "adoption" && byAdoption ? byAdoption : bySpend;
  const items = toItems(apps, mode, currency).map((item, i) =>
    singleOrganization
      ? { ...item, hint: plural(apps[i].subscriptions, "sub") }
      : item
  );

  return (
    <ChartCard
      title="Top apps"
      caption={
        mode === "spend"
          ? `By monthly spend, in ${currency}`
          : "By number of organisations using them"
      }
      className="h-[380px]"
      testId="analytics-top-apps"
      empty={
        bySpend.length === 0
          ? { icon: AppWindow, message: "No active subscriptions yet." }
          : null
      }
      actions={
        byAdoption ? (
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && setMode(v as Mode)}
            className="bg-muted gap-0 rounded-md p-[3px]"
            aria-label="Rank apps by"
          >
            <ToggleGroupItem value="spend" className={ITEM_CLASSES}>
              Spend
            </ToggleGroupItem>
            <ToggleGroupItem value="adoption" className={ITEM_CLASSES}>
              Adoption
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <RankedList items={items} />
      </div>
    </ChartCard>
  );
}
