// src/app/(auth)/forgot-password/page.tsx
// 비밀번호 재설정 요청 페이지

import { requestPasswordReset } from "@/actions/password";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@/lib/auth";
import { ArrowLeft, Mail } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

interface ForgotPasswordPageProps {
  searchParams: Promise<{
    success?: string;
  }>;
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const t = await getTranslations();
  const { success } = await searchParams;

  // 이미 로그인된 사용자 체크
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  // 이메일 발송 성공 시
  if (success === "true") {
    return (
      <div className="flex w-full flex-col gap-5">
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="tonal-success mb-3 flex size-14 items-center justify-center rounded-full">
            <Mail className="size-7" />
          </div>
          <h2 className="text-foreground text-2xl font-medium">
            {t("auth.forgot.success.title")}
          </h2>
          <p className="text-muted-foreground text-[0.9375rem]">
            {t("auth.forgot.success.description")}
          </p>
        </div>
        <Alert>
          <AlertDescription>{t("auth.forgot.success.notice")}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">
            <ArrowLeft className="size-4" />
            {t("auth.forgot.success.backToLogin")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-2xl font-medium">
          {t("auth.forgot.title")}
        </h2>
        <p className="text-muted-foreground text-[0.9375rem]">
          {t("auth.forgot.description")}
        </p>
      </div>
      <form
        action={async (formData: FormData) => {
          "use server";
          const result = await requestPasswordReset(formData);
          if (result.success) {
            redirect("/forgot-password?success=true");
          }
          // 에러 처리는 클라이언트 컴포넌트로 분리 필요
          // 일단 같은 페이지로 리다이렉트
          redirect("/forgot-password?success=true");
        }}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{t("auth.forgot.form.email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={t("auth.forgot.form.emailPlaceholder")}
            required
          />
        </div>
        <Button type="submit" className="w-full">
          {t("auth.forgot.form.submit")}
        </Button>
      </form>
      <Link
        href="/login"
        className="text-primary flex items-center justify-center gap-1.5 text-[0.9375rem] hover:underline"
      >
        <ArrowLeft className="size-4 shrink-0" />
        {t("auth.forgot.footer.backToLogin")}
      </Link>
    </div>
  );
}
