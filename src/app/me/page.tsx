/** 我的资料页：加载并编辑个人信息 */

"use client";

import { ProfileEditForm } from "@/components/user/profile-edit-form";
import { PageShell } from "@/components/layout/page-shell";

export default function MePage() {
  return (
    <PageShell width="md">
      <h1 className="mb-5 text-xl font-bold text-foreground">我的资料</h1>
      <ProfileEditForm />
    </PageShell>
  );
}
