/** 我的资料页：加载并编辑个人信息 */

"use client";

import { ProfileEditForm } from "@/components/user/profile-edit-form";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";

export default function MePage() {
  return (
    <PageShell width="feed">
      <PageHeader title="我的资料" />
      <ProfileEditForm />
    </PageShell>
  );
}
