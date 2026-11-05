// src/app/(auth)/invite/[token]/page.tsx
import { acceptInvitation } from "@/actions/invitations";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

interface InviteAcceptPageProps {
  params: Promise<{ token: string }>;
}

export default async function InviteAcceptPage({
  params,
}: InviteAcceptPageProps) {
  const t = await getTranslations();
  const { token } = await params;

  if (!token) {
    return (
      <div className="flex w-full flex-col gap-1">
        <h1 className="text-foreground text-2xl font-medium">
          {t("auth.invite.title")}
        </h1>
        <p className="text-error text-[0.9375rem]">
          {t("auth.invite.invalid")}
        </p>
      </div>
    );
  }

  const result = await acceptInvitation(token);

  if (result.success) {
    // Refresh the session, then redirect to /apps (reflects organizationId in the JWT)
    redirect("/api/auth/refresh-session?callbackUrl=/dashboard");
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <h1 className="text-foreground text-2xl font-medium">
        {t("auth.invite.title")}
      </h1>
      {result.success ? (
        <>
          <p className="text-muted-foreground text-[0.9375rem]">
            {t("auth.invite.success")}
          </p>
        </>
      ) : (
        <>
          <p className="text-error text-[0.9375rem]">{result.message}</p>
          <Link
            href="/login"
            className="text-primary mt-4 text-[0.9375rem] hover:underline"
          >
            {t("auth.invite.cta")}
          </Link>
        </>
      )}
    </div>
  );
}
