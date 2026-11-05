"use client";

import { KanbanCard } from "@/components/kanban/kanban-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/task";
import { useDroppable } from "@dnd-kit/core";
import { GripVertical, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onAddTask?: () => void;
  onTaskClick?: (task: Task) => void;
}

const columnColors: Record<TaskStatus, string> = {
  TODO: "border-t-neutral",
  IN_PROGRESS: "border-t-info",
  IN_REVIEW: "border-t-warning",
  DONE: "border-t-success",
  CANCELLED: "border-t-error",
};

export function KanbanColumn({
  status,
  tasks,
  onAddTask,
  onTaskClick,
}: KanbanColumnProps) {
  const t = useTranslations("kanban");
  const tTasks = useTranslations("tasks");
  const { isOver, setNodeRef } = useDroppable({
    id: status,
  });

  const getStatusLabel = (status: TaskStatus): string => {
    const statusMap: Record<
      TaskStatus,
      | "status.todo"
      | "status.inProgress"
      | "status.inReview"
      | "status.done"
      | "status.cancelled"
    > = {
      TODO: "status.todo",
      IN_PROGRESS: "status.inProgress",
      IN_REVIEW: "status.inReview",
      DONE: "status.done",
      CANCELLED: "status.cancelled",
    };
    return tTasks(statusMap[status]);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-muted/60 flex w-80 min-w-0 shrink-0 flex-col rounded-lg border-t-4 transition-colors",
        columnColors[status],
        isOver && "bg-muted/60 ring-primary/20 ring-2"
      )}
    >
      {/* Column header */}
      <div className="border-border flex min-w-0 items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-foreground truncate text-[0.9375rem] font-medium">
            {getStatusLabel(status)}
          </span>
          <span className="tonal-primary flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums">
            {tasks.length}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-8"
          >
            <GripVertical className="text-muted-foreground h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary size-8"
            onClick={onAddTask}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Card list */}
      <div className="min-h-[200px] flex-1 space-y-4 overflow-y-auto p-4">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick?.(task)}
          />
        ))}

        {tasks.length === 0 && (
          <div className="text-muted-foreground border-border flex flex-col items-center justify-center rounded-md border border-dashed py-8">
            <p className="text-[0.8125rem]">{t("column.empty")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
