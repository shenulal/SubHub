// src/app/(auth)/invite/[token]/page.tsx
import { getInvitationSignupInfo } from "@/actions/invitation-signup";
import { acceptInvitation } from "@/actions/invitations";
import { InviteAccountForm } from "@/components/auth/invite-account-form";
import { Button } from "@/components/ui/button";
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

  if (result.error === "SIGN_IN_REQUIRED") {
    const info = await getInvitationSignupInfo(token);
    if (info) return <InviteSignup token={token} info={info} t={t} />;
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

type Translate = Awaited<ReturnType<typeof getTranslations>>;

/** Not signed in: create the account here, or sign in when one exists. */
function InviteSignup({
  token,
  info,
  t,
}: {
  token: string;
  info: NonNullable<Awaited<ReturnType<typeof getInvitationSignupInfo>>>;
  t: Translate;
}) {
  if (info.hasPassword) {
    return (
      <div className="flex w-full flex-col gap-5" data-testid="invite-sign-in">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-medium">
            {t("auth.invite.signInTitle")}
          </h1>
          <p className="text-muted-foreground text-[0.9375rem]">
            {t("auth.invite.signInDescription")}
          </p>
        </div>
        <Button asChild className="w-full">
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
          >
            {t("auth.invite.signIn")}
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col gap-5" data-testid="invite-signup">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-medium">
          {t("auth.invite.createTitle", {
            organization: info.organizationName,
          })}
        </h1>
        <p className="text-muted-foreground text-[0.9375rem]">
          {t("auth.invite.createDescription")}
        </p>
      </div>
      <InviteAccountForm
        token={token}
        email={info.email}
        passwordHint={info.passwordHint}
        minLength={info.minLength}
      />
    </div>
  );
}
