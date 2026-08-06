/** 账号安全页面：双端登录终端、黑名单与账号注销 */

"use client";

import Link from "next/link";
import { AccountSecurityPanel } from "@/components/user/account-security-panel";

export default function AccountSecurityPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/me" className="text-sm text-muted-foreground hover:text-foreground">← 返回我的资料</Link>
      <h1 className="mb-5 mt-3 text-xl font-bold">账号安全</h1>
      <AccountSecurityPanel />
    </main>
  );
}
