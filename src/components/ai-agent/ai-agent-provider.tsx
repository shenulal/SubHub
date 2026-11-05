"use client";

/**
 * Global AI Agent provider — mounts the floating button and side panel on every page
 * SMP-197 + SMP-198
 */

import { AiFloatingButton } from "./ai-floating-button";
import { AiSidePanel } from "./ai-side-panel";

export function AiAgentProvider() {
  return (
    <>
      <AiFloatingButton />
      <AiSidePanel />
    </>
  );
}
