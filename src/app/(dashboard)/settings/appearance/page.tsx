// src/app/(dashboard)/settings/appearance/page.tsx
import { AppearanceSettingsClient } from "@/components/settings/appearance-settings-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Appearance",
  description: "Manage theme and display settings",
};

export default function AppearanceSettingsPage() {
  return <AppearanceSettingsClient />;
}
