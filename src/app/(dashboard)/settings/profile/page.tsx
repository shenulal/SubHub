// src/app/(dashboard)/settings/profile/page.tsx
import { getAccountSecurity } from "@/actions/account-security";
import { AccountSecurityCard } from "@/components/settings/account-security-card";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { ProfileForm } from "@/components/settings/profile-form";
import { auth } from "@/lib/auth";
import {
  describePasswordPolicy,
  getPasswordPolicy,
} from "@/lib/auth/password-policy";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Edit Profile",
  description: "Edit your personal profile information",
};

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      // jobTitle: true, // commented out
      department: true,
      // avatarUrl: true, // commented out
    },
  });

  const [security, policy] = await Promise.all([
    getAccountSecurity(),
    getPasswordPolicy(session.user.organizationId ?? null),
  ]);

  return (
    <div className="space-y-6">
      <ProfileForm
        defaultValues={{
          name: user?.name || "",
          title: "",
          department: user?.department || "",
          avatarUrl: "",
        }}
        userEmail={session.user.email || undefined}
      />

      {security && (
        <AccountSecurityCard
          username={security.username}
          hasPassword={security.hasPassword}
          passwordChangedAt={security.passwordChangedAt}
          loginOtpEnabled={security.loginOtpEnabled}
          loginOtpRequired={security.loginOtpRequired}
          passwordHint={describePasswordPolicy(policy)}
          minLength={policy.minLength}
        />
      )}

      <DeleteAccountSection />
    </div>
  );
}
