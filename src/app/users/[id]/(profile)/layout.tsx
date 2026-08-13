import type { ReactNode } from "react";
import { UserProfileShell } from "@/components/user/user-profile-shell";

export default async function UserProfileLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserProfileShell userId={id}>{children}</UserProfileShell>;
}
