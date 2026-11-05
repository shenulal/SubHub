/**
 * Sidebar preview layout (no auth required)
 * URL: /sidebar-preview
 * Local-only, for checking the sidebar menu structure
 */
import { SidebarWrapper } from "@/components/layouts/sidebar-wrapper";

export default function SidebarPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarWrapper
      defaultOpen={true}
      role="ADMIN"
      user={{ name: "Preview", email: "preview@example.com" }}
    >
      {children}
    </SidebarWrapper>
  );
}
