"use client";

/**
 * AI Agent 플로팅 버튼
 * SMP-197 + SMP-198
 *
 * Materio FAB: 48px primary circle pinned bottom-right. The app footer
 * reserves bottom clearance (pb-20) so content can scroll clear of it.
 */

import { Button } from "@/components/ui/button";
import { useAiPanelStore } from "@/lib/ai/ai-panel-store";
import { Bot } from "lucide-react";

export function AiFloatingButton() {
  const { isOpen, toggle } = useAiPanelStore();

  if (isOpen) return null;

  return (
    <>
      <Button
        onClick={toggle}
        size="icon"
        className="bg-primary text-primary-foreground hover:bg-primary-dark fixed right-6 bottom-6 z-50 size-12 rounded-full shadow-lg transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
        aria-label="AI 어시스턴트 열기"
      >
        <Bot className="size-6" />
      </Button>
    </>
  );
}
