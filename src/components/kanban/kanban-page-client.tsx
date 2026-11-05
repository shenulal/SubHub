"use client";

import { KanbanBoard } from "@/components/kanban/kanban-board";
import { TaskTable } from "@/components/tasks/task-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Task, TaskStatus } from "@/types/task";
import { formatDistanceToNow } from "date-fns";
import { Filter, LayoutGrid, List, Plus, Search, Table } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

// Demo data
const demoTasks: Task[] = [
  {
    id: "1",
    title: "Slack licence optimisation",
    description: "Clean up unused licences and review a plan downgrade",
    status: "TODO",
    priority: "HIGH",
    assignee: {
      id: "1",
      name: "Ahmed Al Mansoori",
      email: "ahmed@company.com",
    },
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    tags: ["Cost saving", "Slack"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    title: "Notion team workspace consolidation",
    description:
      "Consolidate scattered workspaces into a single enterprise workspace",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    assignee: {
      id: "2",
      name: "Fatima Al Hashimi",
      email: "fatima@company.com",
    },
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    tags: ["Notion", "Consolidation"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "3",
    title: "Leaver account recovery - Q4",
    description: "Clean up unrecovered SaaS accounts of Q4 leavers",
    status: "IN_REVIEW",
    priority: "URGENT",
    assignee: {
      id: "1",
      name: "Ahmed Al Mansoori",
      email: "ahmed@company.com",
    },
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    tags: ["Security", "Account management"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "4",
    title: "Figma annual contract review",
    description: "Review licence count and plan before the renewal date",
    status: "DONE",
    priority: "MEDIUM",
    assignee: { id: "3", name: "Omar Khalid", email: "omar@company.com" },
    tags: ["Figma", "Renewal"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "5",
    title: "AWS cost analysis report",
    description:
      "Monthly AWS cost analysis and identification of optimisation opportunities",
    status: "TODO",
    priority: "LOW",
    assignee: null,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    tags: ["AWS", "Cost analysis"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "6",
    title: "Security audit preparation",
    description:
      "Organise the SaaS inventory and permissions for the annual security audit",
    status: "IN_PROGRESS",
    priority: "HIGH",
    assignee: {
      id: "2",
      name: "Fatima Al Hashimi",
      email: "fatima@company.com",
    },
    tags: ["Security", "Audit"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "7",
    title: "New employee onboarding automation",
    description:
      "Build a workflow that automatically creates SaaS accounts for new joiners",
    status: "TODO",
    priority: "MEDIUM",
    assignee: { id: "3", name: "Omar Khalid", email: "omar@company.com" },
    tags: ["Automation", "Onboarding"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "8",
    title: "SSO integration completed",
    description: "Okta SSO integration and testing completed",
    status: "DONE",
    priority: "HIGH",
    assignee: {
      id: "1",
      name: "Ahmed Al Mansoori",
      email: "ahmed@company.com",
    },
    tags: ["SSO", "Okta"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

type ViewMode = "board" | "list" | "table";

interface KanbanPageClientProps {
  canManage?: boolean;
}

export function KanbanPageClient({ canManage = false }: KanbanPageClientProps) {
  const t = useTranslations("kanban");
  const tTasks = useTranslations("tasks");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [tasks, setTasks] = useState<Task[]>(demoTasks);

  // Task move handler (drag and drop)
  const handleTaskMove = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, status: newStatus, updatedAt: new Date() }
            : task
        )
      );
    },
    []
  );

  // Search filtering
  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const query = searchQuery.toLowerCase();
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  // Assignee avatar list (demo)
  const assignees = [
    { id: "1", name: "Ahmed Al Mansoori" },
    { id: "2", name: "Fatima Al Hashimi" },
    { id: "3", name: "Omar Khalid" },
  ];

  return (
    <div className="min-w-0 space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-foreground text-2xl font-medium">
            {t("header.title")}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Assignee avatars */}
          <div className="flex shrink-0 -space-x-2">
            {assignees.map((assignee) => (
              <Avatar key={assignee.id} className="border-card size-9 border-2">
                <AvatarFallback className="tonal-primary text-xs">
                  {assignee.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            ))}
            <div className="border-card tonal-neutral flex size-9 items-center justify-center rounded-full border-2 text-xs font-medium">
              +5
            </div>
          </div>

          {canManage && (
            <Button className="shrink-0 whitespace-nowrap">
              <Plus className="size-4" />
              {t("header.addAssignee")}
            </Button>
          )}
        </div>
      </div>

      {/* View toggle + search/filter */}
      <div className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-lg px-5 pt-2 pb-4 shadow-md lg:py-3">
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
        >
          <TabsList>
            <TabsTrigger value="board" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              {t("views.board")}
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              {t("views.list")}
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <Table className="h-4 w-4" />
              {t("views.table")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="relative w-full min-w-0 sm:w-64">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder={t("search.placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9"
            />
          </div>

          <Button variant="outline" className="shrink-0 whitespace-nowrap">
            <Filter className="size-4" />
            {t("actions.filters")}
          </Button>

          {canManage && (
            <Button className="shrink-0 whitespace-nowrap">
              <Plus className="size-4" />
              {t("actions.addBoard")}
            </Button>
          )}
        </div>
      </div>

      {/* Content area */}
      {viewMode === "board" && (
        <KanbanBoard
          tasks={filteredTasks}
          onAddTask={(status) => console.log("Add task to:", status)}
          onTaskClick={(task) => console.log("Task clicked:", task)}
          onTaskMove={handleTaskMove}
        />
      )}

      {viewMode === "list" && (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg p-4 shadow-xs sm:flex-nowrap"
            >
              <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                <h4
                  className="text-foreground truncate text-[0.9375rem] font-medium"
                  title={task.title}
                >
                  {task.title}
                </h4>
                {task.description && (
                  <p className="text-muted-foreground line-clamp-1 text-[0.8125rem]">
                    {task.description}
                  </p>
                )}
              </div>
              <Badge variant="outline">
                {task.status === "TODO" && tTasks("status.todo")}
                {task.status === "IN_PROGRESS" && tTasks("status.inProgress")}
                {task.status === "IN_REVIEW" && tTasks("status.inReview")}
                {task.status === "DONE" && tTasks("status.done")}
                {task.status === "CANCELLED" && tTasks("status.cancelled")}
              </Badge>
              <Badge variant="secondary">
                {task.dueDate
                  ? formatDistanceToNow(task.dueDate, {
                      addSuffix: true,
                    })
                  : t("list.noDueDate")}
              </Badge>
              <Badge variant="secondary">
                {task.priority === "URGENT" && tTasks("priority.urgent")}
                {task.priority === "HIGH" && tTasks("priority.high")}
                {task.priority === "MEDIUM" && tTasks("priority.medium")}
                {task.priority === "LOW" && tTasks("priority.low")}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {viewMode === "table" && (
        <TaskTable
          tasks={filteredTasks}
          canManage={canManage}
          onEdit={(task) => console.log("Edit:", task)}
          onDelete={(id) => console.log("Delete:", id)}
        />
      )}
    </div>
  );
}
