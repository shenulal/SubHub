import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SidebarWrapper } from "@/components/layouts/sidebar-wrapper";
import { ClientProviders } from "@/components/providers/client-providers";
import { getCachedSession } from "@/lib/auth/require-auth";
import { CHANGE_PASSWORD_PATH } from "@/lib/auth/sign-in-codes";
import { homeForUserWithoutOrganization } from "@/lib/platform/identity";

/**
 * Dashboard layout
 * Applied to pages that only authenticated users can access
 * Main layout including the sidebar and header
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the sidebar state from the cookie
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Get the role from the session
  const session = await getCachedSession();

  // Redirect unauthenticated users to login
  if (!session?.user) {
    redirect("/login");
  }

  // Temporary password set by an administrator: change it first
  if (session.user.mustChangePassword) {
    redirect(CHANGE_PASSWORD_PATH);
  }

  // Users without an organization: onboarding (platform super admins: the Control Panel)
  if (!session.user.organizationId) {
    redirect(homeForUserWithoutOrganization(session.user.role as string));
  }

  const role = session.user.role ?? null;
  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? "",
  };

  return (
    <ClientProviders>
      <SidebarWrapper
        defaultOpen={defaultOpen}
        role={role as "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER" | null}
        user={user}
      >
        {children}
      </SidebarWrapper>
    </ClientProviders>
  );
}
