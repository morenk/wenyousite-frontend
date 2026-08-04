/** 账号安全页面：设备会话、黑名单与账号注销 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AccountSecurityPanel } from "@/components/user/account-security-panel";

export default function AccountSecurityPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuth();

  useEffect(() => {
    if (isInitialized && !user) router.replace("/login");
  }, [isInitialized, router, user]);

  if (!isInitialized || !user) {
    return <Loader2 className="mx-auto mt-20 h-6 w-6 animate-spin text-muted-foreground" />;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/me" className="text-sm text-muted-foreground hover:text-foreground">← 返回我的资料</Link>
      <h1 className="mb-5 mt-3 text-xl font-bold">账号安全</h1>
      <AccountSecurityPanel />
    </main>
  );
}
