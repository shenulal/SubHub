// src/app/(dashboard)/settings/budget/page.tsx
// Budget settings now live in the registry-driven Finance group.
import { redirect } from "next/navigation";

const FINANCE_SETTINGS_PATH = "/settings/workspace/finance";

export default function BudgetSettingsPage() {
  redirect(FINANCE_SETTINGS_PATH);
}
