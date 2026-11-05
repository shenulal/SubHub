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
import { ko } from "date-fns/locale";
import { Filter, LayoutGrid, List, Plus, Search, Table } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

// 데모 데이터
const demoTasks: Task[] = [
  {
    id: "1",
    title: "Slack 라이선스 최적화",
    description: "미사용 라이선스 정리 및 플랜 다운그레이드 검토",
    status: "TODO",
    priority: "HIGH",
    assignee: { id: "1", name: "김철수", email: "kim@company.com" },
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    tags: ["비용절감", "Slack"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    title: "Notion 팀 워크스페이스 통합",
    description: "분산된 워크스페이스를 단일 엔터프라이즈로 통합",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    assignee: { id: "2", name: "이영희", email: "lee@company.com" },
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    tags: ["Notion", "통합"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "3",
    title: "퇴사자 계정 회수 - Q4",
    description: "4분기 퇴사자 미회수 SaaS 계정 정리",
    status: "IN_REVIEW",
    priority: "URGENT",
    assignee: { id: "1", name: "김철수", email: "kim@company.com" },
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    tags: ["보안", "계정관리"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "4",
    title: "Figma 연간 계약 검토",
    description: "갱신일 전 라이선스 수 및 플랜 재검토",
    status: "DONE",
    priority: "MEDIUM",
    assignee: { id: "3", name: "박지민", email: "park@company.com" },
    tags: ["Figma", "갱신"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "5",
    title: "AWS 비용 분석 리포트",
    description: "월간 AWS 비용 분석 및 최적화 기회 도출",
    status: "TODO",
    priority: "LOW",
    assignee: null,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    tags: ["AWS", "비용분석"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "6",
    title: "보안 감사 준비",
    description: "연간 보안 감사를 위한 SaaS 목록 및 권한 정리",
    status: "IN_PROGRESS",
    priority: "HIGH",
    assignee: { id: "2", name: "이영희", email: "lee@company.com" },
    tags: ["보안", "감사"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "7",
    title: "신규 직원 온보딩 자동화",
    description: "입사자 SaaS 계정 자동 생성 워크플로우 구축",
    status: "TODO",
    priority: "MEDIUM",
    assignee: { id: "3", name: "박지민", email: "park@company.com" },
    tags: ["자동화", "온보딩"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "8",
    title: "SSO 연동 완료",
    description: "Okta SSO 연동 및 테스트 완료",
    status: "DONE",
    priority: "HIGH",
    assignee: { id: "1", name: "김철수", email: "kim@company.com" },
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

  // 태스크 이동 핸들러 (드래그&드롭)
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

  // 검색 필터링
  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const query = searchQuery.toLowerCase();
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  // 담당자 아바타 목록 (데모)
  const assignees = [
    { id: "1", name: "김철수" },
    { id: "2", name: "이영희" },
    { id: "3", name: "박지민" },
  ];

  return (
    <div className="min-w-0 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-foreground text-2xl font-medium">
            {t("header.title")}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 담당자 아바타 */}
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

      {/* 뷰 전환 + 검색/필터 */}
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

      {/* 콘텐츠 영역 */}
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
                      locale: ko,
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
