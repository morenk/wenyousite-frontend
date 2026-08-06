/** 我的资料页：加载并编辑个人信息 */

"use client";

import { ProfileEditForm } from "@/components/user/profile-edit-form";

export default function MePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-foreground">我的资料</h1>
      <ProfileEditForm />
    </div>
  );
}
