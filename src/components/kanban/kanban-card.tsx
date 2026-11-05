"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority } from "@/types/task";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MessageSquare, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";

interface KanbanCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
}

const priorityColors: Record<TaskPriority, string> = {
  LOW: "border-transparent bg-neutral/15 text-neutral",
  MEDIUM: "border-transparent bg-info/15 text-info",
  HIGH: "border-transparent bg-warning/15 text-warning",
  URGENT: "border-transparent bg-error/15 text-error",
};

export function KanbanCard({
  task,
  onClick,
  isDragging: externalIsDragging,
}: KanbanCardProps) {
  const t = useTranslations("tasks");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: internalIsDragging,
  } = useDraggable({
    id: task.id,
  });

  const isDragging = externalIsDragging ?? internalIsDragging;

  const getPriorityLabel = (priority: TaskPriority): string => {
    const priorityMap: Record<
      TaskPriority,
      "priority.urgent" | "priority.high" | "priority.medium" | "priority.low"
    > = {
      URGENT: "priority.urgent",
      HIGH: "priority.high",
      MEDIUM: "priority.medium",
      LOW: "priority.low",
    };
    return t(priorityMap[priority]);
  };

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Demo progress calculation (random)
  const progress = Math.floor(Math.random() * 100);
  const attachments = Math.floor(Math.random() * 5);
  const comments = Math.floor(Math.random() * 10);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "min-w-0 cursor-grab gap-0 py-0 shadow-xs transition-all",
        isDragging
          ? "ring-primary opacity-50 shadow-lg ring-2"
          : "hover:shadow-md"
      )}
      onClick={onClick}
    >
      <CardHeader className="gap-1.5 p-4 pb-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h4
            className="text-foreground line-clamp-2 min-w-0 flex-1 text-[0.9375rem] leading-snug font-medium break-words"
            title={task.title}
          >
            {task.title}
          </h4>
          <button
            className="text-muted-foreground hover:text-foreground shrink-0 cursor-grab touch-none"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        {task.description && (
          <p className="text-muted-foreground line-clamp-2 text-[0.8125rem] break-words">
            {task.description}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3 px-4 pt-2 pb-4">
        {/* Assignee + progress */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex -space-x-2">
            {task.assignee ? (
              <Avatar className="border-background h-7 w-7 border-2">
                <AvatarImage src={task.assignee.image || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(task.assignee.name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Avatar className="border-background h-7 w-7 border-2">
                <AvatarFallback className="text-xs">?</AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Progress value={progress} className="h-1.5 w-14" />
            <span className="text-muted-foreground w-8 text-right text-xs tabular-nums">
              {progress}%
            </span>
          </div>
        </div>

        {/* Priority + metadata */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium",
              priorityColors[task.priority as TaskPriority]
            )}
          >
            {getPriorityLabel(task.priority as TaskPriority)}
          </Badge>
          <div className="text-muted-foreground flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-1 text-xs">
              <Paperclip className="h-3 w-3" />
              {attachments}
            </div>
            <div className="flex items-center gap-1 text-xs">
              <MessageSquare className="h-3 w-3" />
              {comments}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
