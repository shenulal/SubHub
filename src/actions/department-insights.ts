// src/actions/department-insights.ts
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";

export interface DepartmentSpend {
  department: string;
  totalCost: number;
  headcount: number;
  perEmployee: number;
}

export interface DepartmentTopApp {
  department: string;
  appName: string;
  appCost: number;
}

export interface DepartmentInsights {
  totalDepartments: number;
  departments: DepartmentSpend[];
  topApps: DepartmentTopApp[];
}

export async function getDepartmentInsights(): Promise<DepartmentInsights> {
  const { organizationId } = await requireOrganization();

  // 1. Fetch teams
  const teams = await prisma.team.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });

  if (teams.length === 0) {
    return { totalDepartments: 0, departments: [], topApps: [] };
  }

  // 2. Fetch ACTIVE subscriptions (with teamId, amount, assignedUsers and app info)
  const subscriptions = await prisma.subscription.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      teamId: true,
      amount: true,
      app: { select: { name: true } },
      assignedUsers: {
        select: {
          user: { select: { id: true, teamId: true } },
        },
      },
    },
  });

  // Track cost and users per team
  const teamCostMap = new Map<string, number>();
  const teamUserSet = new Map<string, Set<string>>();
  // Track cost per app per team
  const teamAppCostMap = new Map<string, Map<string, number>>();

  const teamIdSet = new Set(teams.map((t) => t.id));

  for (const sub of subscriptions) {
    const amount = Number(sub.amount);

    if (sub.teamId && teamIdSet.has(sub.teamId)) {
      // Case A: subscription has a teamId → attribute the full amount to that team
      teamCostMap.set(sub.teamId, (teamCostMap.get(sub.teamId) || 0) + amount);

      // Per-app cost
      const appMap =
        teamAppCostMap.get(sub.teamId) || new Map<string, number>();
      appMap.set(sub.app.name, (appMap.get(sub.app.name) || 0) + amount);
      teamAppCostMap.set(sub.teamId, appMap);

      // Count assigned users in that team's headcount
      for (const au of sub.assignedUsers) {
        const userSet = teamUserSet.get(sub.teamId) || new Set<string>();
        userSet.add(au.user.id);
        teamUserSet.set(sub.teamId, userSet);
      }
    } else {
      // Case B: subscription with null teamId → split pro rata by assignedUsers' user.teamId
      const usersWithTeam = sub.assignedUsers.filter(
        (au) => au.user.teamId && teamIdSet.has(au.user.teamId!)
      );
      const totalAssigned = sub.assignedUsers.length;

      if (totalAssigned === 0) continue;

      // Count users per team
      const teamCountInSub = new Map<string, number>();
      for (const au of usersWithTeam) {
        const tid = au.user.teamId!;
        teamCountInSub.set(tid, (teamCountInSub.get(tid) || 0) + 1);
      }

      // Pro-rata split
      for (const [tid, count] of teamCountInSub) {
        const allocatedCost = Math.round((amount * count) / totalAssigned);
        teamCostMap.set(tid, (teamCostMap.get(tid) || 0) + allocatedCost);

        // Per-app cost
        const appMap = teamAppCostMap.get(tid) || new Map<string, number>();
        appMap.set(
          sub.app.name,
          (appMap.get(sub.app.name) || 0) + allocatedCost
        );
        teamAppCostMap.set(tid, appMap);
      }

      // Track user headcount
      for (const au of usersWithTeam) {
        const tid = au.user.teamId!;
        const userSet = teamUserSet.get(tid) || new Set<string>();
        userSet.add(au.user.id);
        teamUserSet.set(tid, userSet);
      }
    }
  }

  // 3. Map team names and build DepartmentSpend
  const departments: DepartmentSpend[] = teams
    .map((team) => {
      const totalCost = teamCostMap.get(team.id) || 0;
      const headcount = teamUserSet.get(team.id)?.size || 0;
      const perEmployee = headcount > 0 ? Math.round(totalCost / headcount) : 0;
      return {
        department: team.name,
        totalCost,
        headcount,
        perEmployee,
      };
    })
    .filter((d) => d.totalCost > 0 || d.headcount > 0)
    .sort((a, b) => b.totalCost - a.totalCost);

  // 4. Top apps: sum per-app cost across all teams, take the top 5
  const globalAppCostMap = new Map<string, number>();
  for (const [, appMap] of teamAppCostMap) {
    for (const [appName, cost] of appMap) {
      globalAppCostMap.set(
        appName,
        (globalAppCostMap.get(appName) || 0) + cost
      );
    }
  }

  const topApps: DepartmentTopApp[] = Array.from(globalAppCostMap.entries())
    .map(([appName, appCost]) => ({ department: "All", appName, appCost }))
    .sort((a, b) => b.appCost - a.appCost)
    .slice(0, 5);

  return {
    totalDepartments: departments.length,
    departments,
    topApps,
  };
}
