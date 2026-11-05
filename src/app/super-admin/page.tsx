// src/app/super-admin/page.tsx
import {
  getResourceUsage,
  getSuperAdminStats,
} from "@/actions/super-admin/dashboard";
import { ResourceSummaryTable } from "@/components/super-admin/resource-summary-table";
import { StatsKpiCards } from "@/components/super-admin/stats-kpi-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "사용 현황 | Super Admin",
};

export default async function SuperAdminHomePage() {
  const [statsResult, resourceResult] = await Promise.all([
    getSuperAdminStats(),
    getResourceUsage(),
  ]);

  // 테넌트 없는 경우 안내
  const noTenant =
    !statsResult.success &&
    statsResult.message === "테넌트 정보를 찾을 수 없습니다.";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-foreground text-2xl font-medium">사용 현황</h1>
        <p className="text-muted-foreground text-[0.9375rem]">
          테넌트 전체 현황을 확인합니다.
        </p>
      </div>

      {noTenant ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="text-muted-foreground text-[0.9375rem]">
              아직 테넌트가 없습니다. 테넌트를 먼저 생성해주세요.
            </p>
            <Button asChild>
              <Link href="/super-admin/tenant">테넌트 생성하기</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {statsResult.success && statsResult.data ? (
            <StatsKpiCards stats={statsResult.data} />
          ) : (
            <div className="tonal-error rounded-md p-4 text-[0.9375rem]">
              {statsResult.message ?? "통계를 불러오는데 실패했습니다."}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>앱별 구독 현황</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {resourceResult.success && resourceResult.data ? (
                <ResourceSummaryTable data={resourceResult.data} />
              ) : (
                <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
                  데이터를 불러올 수 없습니다.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
