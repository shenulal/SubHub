// src/app/(dashboard)/users/[id]/page.tsx
import { getUserCached } from "@/actions/users";
import { UserDetailClient } from "@/components/users/user-detail-client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface UserDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: UserDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await getUserCached(id);

  if (!user) {
    return {
      title: "User not found",
    };
  }

  return {
    title: `${user.name || user.email}`,
    description: `Details and app access for ${user.name || user.email}`,
  };
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { id } = await params;
  const user = await getUserCached(id);

  if (!user) {
    notFound();
  }

  return <UserDetailClient id={id} />;
}
