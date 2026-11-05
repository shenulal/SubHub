// src/app/super-admin/tenant/page.tsx
import { getTenantInfo } from "@/actions/super-admin/tenant-settings";
import { CreateTenantForm } from "@/components/super-admin/create-tenant-form";
import { TenantSettingsForm } from "@/components/super-admin/tenant-settings-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "테넌트 설정 | Super Admin",
};

export default async function TenantSettingsPage() {
  const result = await getTenantInfo();

  // 테넌트가 없는 경우 → 생성 폼 표시
  if (!result.success || !result.data) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-medium">테넌트 설정</h1>
          <p className="text-muted-foreground text-[0.9375rem]">
            조직의 기본 정보를 관리합니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>테넌트 생성</CardTitle>
            <CardDescription>
              아직 테넌트(조직)가 없습니다. 먼저 테넌트를 생성해주세요. 생성 후
              관리자를 초대할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateTenantForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  const tenant = result.data;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-foreground text-2xl font-medium">테넌트 설정</h1>
        <p className="text-muted-foreground text-[0.9375rem]">
          조직의 기본 정보를 관리합니다.
        </p>
      </div>

      {/* 기본 정보 카드 */}
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
          <CardDescription className="truncate">
            테넌트 ID: <code className="font-mono text-xs">{tenant.id}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="bg-muted min-w-0 rounded-md p-4">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              총 사용자
            </span>
            <p className="text-foreground truncate text-lg font-medium tabular-nums">
              {tenant.userCount.toLocaleString("ko-KR")}명
            </p>
          </div>
          <div className="bg-muted min-w-0 rounded-md p-4">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              총 구독
            </span>
            <p className="text-foreground truncate text-lg font-medium tabular-nums">
              {tenant.subscriptionCount.toLocaleString("ko-KR")}개
            </p>
          </div>
          <div className="bg-muted min-w-0 rounded-md p-4">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              생성일
            </span>
            <p className="text-foreground truncate text-lg font-medium tabular-nums">
              {new Date(tenant.createdAt).toLocaleDateString("ko-KR")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 수정 폼 */}
      <Card>
        <CardHeader>
          <CardTitle>정보 수정</CardTitle>
          <CardDescription>
            회사명, 도메인, 로고 URL을 수정할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantSettingsForm tenant={tenant} />
        </CardContent>
      </Card>
    </div>
  );
}
