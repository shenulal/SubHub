"use client";

import { FilterMultiSelect } from "@/components/common/filter-multi-select";
import { KpiCard, KpiCardsGrid } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { TaskTable } from "@/components/tasks/task-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Task } from "@/types/task";
import { AlertTriangle, Circle, Clock, ListTodo, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

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
];

interface TasksPageClientProps {
  canManage?: boolean;
}

export function TasksPageClient({ canManage = false }: TasksPageClientProps) {
  const t = useTranslations("tasks");
  // Multi-select filters (empty = all)
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);

  // Compute statistics
  const stats = useMemo(() => {
    const todoCount = demoTasks.filter((t) => t.status === "TODO").length;
    const inProgressCount = demoTasks.filter(
      (t) => t.status === "IN_PROGRESS"
    ).length;
    const doneCount = demoTasks.filter((t) => t.status === "DONE").length;
    const urgentCount = demoTasks.filter((t) => t.priority === "URGENT").length;
    return { todoCount, inProgressCount, doneCount, urgentCount };
  }, []);

  // Filtering
  const filteredTasks = useMemo(() => {
    let result = demoTasks;

    if (statusFilter.length) {
      result = result.filter((t) => statusFilter.includes(t.status));
    }

    if (priorityFilter.length) {
      result = result.filter((t) => priorityFilter.includes(t.priority));
    }

    return result;
  }, [statusFilter, priorityFilter]);

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={t("page.title")}
        description={t("page.description")}
        actions={[
          {
            label: t("actions.add"),
            icon: Plus,
            href: "/tasks/new",
            disabled: !canManage,
          },
        ]}
      />

      {/* KPI cards */}
      <KpiCardsGrid columns={4}>
        <KpiCard
          title={t("kpi.total")}
          value={demoTasks.length}
          icon={ListTodo}
          href="/tasks"
        />
        <KpiCard
          title={t("kpi.todo")}
          value={stats.todoCount}
          icon={Circle}
          change={
            demoTasks.length > 0
              ? {
                  value: Math.round((stats.todoCount / demoTasks.length) * 100),
                  type: "neutral",
                }
              : undefined
          }
        />
        <KpiCard
          title={t("kpi.inProgress")}
          value={stats.inProgressCount}
          icon={Clock}
        />
        <KpiCard
          title={t("kpi.urgent")}
          value={stats.urgentCount}
          icon={AlertTriangle}
        />
      </KpiCardsGrid>

      {/* Filter bar */}
      <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg px-5 py-4 shadow-md">
        <FilterMultiSelect
          label={t("filter.status")}
          placeholder={t("filter.allStatuses")}
          options={[
            { value: "TODO", label: t("status.todo") },
            { value: "IN_PROGRESS", label: t("status.inProgress") },
            { value: "IN_REVIEW", label: t("status.inReview") },
            { value: "DONE", label: t("status.done") },
            { value: "CANCELLED", label: t("status.cancelled") },
          ]}
          value={statusFilter}
          onValueChange={setStatusFilter}
        />

        <FilterMultiSelect
          label={t("filter.priority")}
          placeholder={t("filter.allPriorities")}
          options={[
            { value: "URGENT", label: t("priority.urgent") },
            { value: "HIGH", label: t("priority.high") },
            { value: "MEDIUM", label: t("priority.medium") },
            { value: "LOW", label: t("priority.low") },
          ]}
          value={priorityFilter}
          onValueChange={setPriorityFilter}
        />

        {(statusFilter.length > 0 || priorityFilter.length > 0) && (
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-primary h-10 whitespace-nowrap"
            onClick={() => {
              setStatusFilter([]);
              setPriorityFilter([]);
            }}
          >
            {t("filter.reset")}
          </Button>
        )}

        <div className="ml-auto shrink-0">
          <Badge variant="primary" className="h-7 px-3 text-[0.8125rem]">
            {t("filter.count", { count: filteredTasks.length })}
          </Badge>
        </div>
      </div>

      {/* Task table */}
      <Card className="overflow-hidden pb-0">
        <CardContent className="p-0">
          <TaskTable
            tasks={filteredTasks}
            canManage={canManage}
            onEdit={(task) => console.log("Edit:", task)}
            onDelete={(id) => console.log("Delete:", id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
