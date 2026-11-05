"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import {
  getTeamHierarchy,
  getTeamMembers,
  getTeamStats,
  type TeamMember,
  type TeamNode,
  type TeamWithStats,
} from "@/actions/teams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { ReportStatCard } from "@/components/reports/report-stat-card";

import { CreateTeamDialog } from "./create-team-dialog";
import { DeleteTeamDialog } from "./delete-team-dialog";
import { EditTeamDialog } from "./edit-team-dialog";

interface TeamsPageClientProps {
  initialTeams?: TeamNode[];
}

interface TeamStats {
  totalTeams: number;
  teamsWithMembers: number;
  avgMembersPerTeam: number;
  maxDepth: number;
}

export function TeamsPageClient({ initialTeams }: TeamsPageClientProps) {
  const t = useTranslations();
  const [teams, setTeams] = useState<TeamNode[]>(initialTeams || []);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(!initialTeams);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithStats | null>(null);
  // #6: 팀 멤버 표시 기능
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember[]>>(
    {}
  );
  const [loadingMembers, setLoadingMembers] = useState<Set<string>>(new Set());
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(
    new Set()
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [teamsResult, statsResult] = await Promise.all([
        getTeamHierarchy(),
        getTeamStats(),
      ]);

      if (teamsResult.success && teamsResult.data) {
        setTeams(teamsResult.data);
        // 기본적으로 1단계까지 펼침
        const firstLevel = new Set(teamsResult.data.map((t) => t.id));
        setExpandedTeams(firstLevel);
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialTeams) {
      loadData();
    }
  }, [initialTeams, loadData]);

  const handleRefresh = () => {
    startTransition(() => {
      loadData();
    });
  };

  const toggleExpand = (teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: TeamNode[]) => {
      nodes.forEach((node) => {
        allIds.add(node.id);
        if (node.children) {
          collectIds(node.children);
        }
      });
    };
    collectIds(teams);
    setExpandedTeams(allIds);
    setExpandedMembers(new Set(allIds));
    // 아직 로드되지 않은 팀의 멤버 데이터 로드
    allIds.forEach((id) => loadTeamMembers(id));
  };

  const collapseAll = () => {
    setExpandedTeams(new Set());
    setExpandedMembers(new Set());
  };

  // 팀 멤버 로드
  const loadTeamMembers = useCallback(
    async (teamId: string) => {
      if (teamMembers[teamId]) return; // 이미 로드됨
      setLoadingMembers((prev) => new Set(prev).add(teamId));
      try {
        const result = await getTeamMembers(teamId);
        if (result.success && result.data) {
          setTeamMembers((prev) => ({ ...prev, [teamId]: result.data! }));
        }
      } finally {
        setLoadingMembers((prev) => {
          const next = new Set(prev);
          next.delete(teamId);
          return next;
        });
      }
    },
    [teamMembers]
  );

  // 팀 멤버 토글
  const toggleMembers = useCallback(
    (teamId: string) => {
      const isCurrentlyExpanded = expandedMembers.has(teamId);

      setExpandedMembers((prev) => {
        const next = new Set(prev);
        if (next.has(teamId)) {
          next.delete(teamId);
        } else {
          next.add(teamId);
        }
        return next;
      });

      // Side effect를 state updater 외부에서 실행
      if (!isCurrentlyExpanded) {
        loadTeamMembers(teamId);
      }
    },
    [loadTeamMembers, expandedMembers]
  );

  // 검색 필터링
  const filterTeams = (nodes: TeamNode[], query: string): TeamNode[] => {
    if (!query) return nodes;

    const lowerQuery = query.toLowerCase();

    const matchesQuery = (node: TeamNode): boolean => {
      if (node.name.toLowerCase().includes(lowerQuery)) return true;
      if (node.description?.toLowerCase().includes(lowerQuery)) return true;
      if (node.googleOrgUnitPath?.toLowerCase().includes(lowerQuery))
        return true;
      return false;
    };

    const filterNode = (node: TeamNode): TeamNode | null => {
      const filteredChildren = node.children
        .map((child) => filterNode(child))
        .filter((c): c is TeamNode => c !== null);

      if (matchesQuery(node) || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };

    return nodes
      .map((node) => filterNode(node))
      .filter((n): n is TeamNode => n !== null);
  };

  const filteredTeams = filterTeams(teams, searchQuery);

  // 수정 다이얼로그 열기
  const openEditDialog = (team: TeamNode) => {
    setSelectedTeam(team);
    setIsEditDialogOpen(true);
  };

  // 삭제 다이얼로그 열기
  const openDeleteDialog = (team: TeamNode) => {
    setSelectedTeam(team);
    setIsDeleteDialogOpen(true);
  };

  const renderTeamNode = (node: TeamNode, depth: number = 0) => {
    const isExpanded = expandedTeams.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isManualTeam = !node.googleOrgUnitId; // 수동 생성 팀 여부
    const isMembersExpanded = expandedMembers.has(node.id);

    return (
      <div key={node.id} style={{ paddingLeft: `${depth * 24}px` }}>
        <div
          className={`group hover:bg-muted flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors ${isMembersExpanded ? "bg-primary/[0.08]" : ""}`}
          onClick={() => toggleMembers(node.id)}
        >
          {/* 자식 팀 펼침/접힘 버튼 (자식 있을 때만) */}
          <div className="w-5 shrink-0">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-5" />
            )}
          </div>

          {/* 팀 아이콘 */}
          <span className="tonal-primary flex size-7 shrink-0 items-center justify-center rounded-md">
            <FolderTree className="h-4 w-4" />
          </span>

          {/* 팀 이름 */}
          <span
            className="min-w-0 flex-1 truncate font-medium"
            title={node.name}
          >
            {node.name}
          </span>

          {/* 멤버 수 (정보 표시용 Badge) */}
          <Badge
            variant="secondary"
            className="flex shrink-0 items-center gap-1 tabular-nums"
          >
            <Users className="h-3 w-3" />
            <span>{node._count?.members || 0}</span>
          </Badge>

          {/* Google OU 배지 */}
          {node.googleOrgUnitPath && (
            <Badge variant="info" className="shrink-0">
              OU
            </Badge>
          )}

          {/* 멤버 펼침 상태 아이콘 */}
          {isMembersExpanded ? (
            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
          )}

          {/* 수동 팀: 수정/삭제 메뉴 */}
          {isManualTeam && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditDialog(node);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("teams.tree.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    openDeleteDialog(node);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("teams.tree.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* 팀 멤버 목록 (팀 행 바로 아래, 자식 팀 위) */}
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-in-out"
          style={{ gridTemplateRows: isMembersExpanded ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="bg-muted mt-1 mr-2 mb-2 ml-10 rounded-md p-3">
              {loadingMembers.has(node.id) ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : teamMembers[node.id]?.length ? (
                <div className="space-y-2">
                  {teamMembers[node.id].map((member) => (
                    <div
                      key={member.id}
                      className="flex min-w-0 items-center gap-2 text-sm"
                    >
                      <span
                        aria-hidden
                        className="tonal-primary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium uppercase"
                      >
                        {(member.name || member.email || "?").charAt(0)}
                      </span>
                      <span className="max-w-[12rem] truncate font-medium">
                        {member.name}
                      </span>
                      <span className="text-muted-foreground min-w-0 truncate text-xs">
                        {member.email}
                      </span>
                      {member.role && (
                        <Badge variant="secondary" className="shrink-0">
                          {member.role}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("teams.tree.noMembers")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 자식 팀 렌더링 (멤버 패널 아래) */}
        {isExpanded && hasChildren && (
          <div className="border-muted ml-5 border-l">
            {node.children.map((child) => renderTeamNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent>
                <Skeleton className="size-10 rounded-md" />
                <Skeleton className="mt-4 h-4 w-24" />
                <Skeleton className="mt-2 h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tree Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ReportStatCard
            icon={FolderTree}
            tone="primary"
            title={t("teams.stats.totalTeams")}
            value={String(stats.totalTeams)}
          />
          <ReportStatCard
            icon={Users}
            tone="info"
            title={t("teams.stats.teamsWithMembers")}
            value={String(stats.teamsWithMembers)}
          />
        </div>
      )}

      {/* 팀 트리 */}
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <CardTitle className="flex min-w-0 items-center gap-3">
              <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
                <FolderTree className="size-5" />
              </span>
              <span className="truncate">{t("teams.tree.title")}</span>
            </CardTitle>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleRefresh}
                disabled={isPending}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}
                />
              </Button>
              <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("teams.tree.addTeam")}
              </Button>
            </div>
          </div>
          {/* 검색 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder={t("teams.tree.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-9"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" className="h-10" onClick={expandAll}>
                {t("teams.tree.expandAll")}
              </Button>
              <Button variant="outline" className="h-10" onClick={collapseAll}>
                {t("teams.tree.collapseAll")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="tonal-neutral flex size-10 items-center justify-center rounded-md">
                <FolderTree className="size-5" />
              </div>
              <p className="text-muted-foreground">
                {searchQuery
                  ? t("teams.tree.noSearchResults")
                  : t("teams.tree.empty")}
              </p>
            </div>
          ) : (
            <ScrollArea className="min-h-[450px]">
              <div className="space-y-1">
                {filteredTeams.map((team) => renderTeamNode(team))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* 팀 생성 다이얼로그 */}
      <CreateTeamDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={loadData}
      />

      {/* 팀 수정 다이얼로그 */}
      {selectedTeam && (
        <EditTeamDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setSelectedTeam(null);
          }}
          team={selectedTeam}
          onSuccess={loadData}
        />
      )}

      {/* 팀 삭제 다이얼로그 */}
      {selectedTeam && (
        <DeleteTeamDialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            setIsDeleteDialogOpen(open);
            if (!open) setSelectedTeam(null);
          }}
          team={selectedTeam}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
