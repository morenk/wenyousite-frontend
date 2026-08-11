/** 账号安全页面：双端登录终端、黑名单与账号注销 */

"use client";

import { AccountSecurityPanel } from "@/components/user/account-security-panel";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

export default function AccountSecurityPage() {
  return (
    <PageShell width="feed">
      <PageHeader title="账号安全" backHref="/me" backLabel="返回我的资料" />
      <AccountSecurityPanel />
    </PageShell>
  );
}
