// src/app/(dashboard)/settings/profile/page.tsx
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { ProfileForm } from "@/components/settings/profile-form";
import { auth } from "@/lib/auth";
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

      <DeleteAccountSection />
    </div>
  );
}
