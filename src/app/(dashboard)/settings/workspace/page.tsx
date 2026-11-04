// src/app/(dashboard)/settings/workspace/page.tsx
import { redirect } from "next/navigation";

const DEFAULT_GROUP = "general";

export default function WorkspaceSettingsIndexPage() {
  redirect(`/settings/workspace/${DEFAULT_GROUP}`);
}
