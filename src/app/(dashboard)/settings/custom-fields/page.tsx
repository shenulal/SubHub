// src/app/(dashboard)/settings/custom-fields/page.tsx
import { redirect } from "next/navigation";

export const metadata = { title: "Custom fields" };

/** Custom fields now live in the Master data hub. */
export default function CustomFieldsSettingsPage() {
  redirect("/settings/masters?tab=custom-fields");
}
