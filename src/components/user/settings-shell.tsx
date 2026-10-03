"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isSettings =
    /^\/me(?:\/(?:appearance|privacy|security|password|email))?$/.test(
      pathname,
    );
  if (!isSettings) return children;
  const isForm = pathname === "/me/password" || pathname === "/me/email";
  return (
    <div data-settings-surface className="min-h-screen bg-muted/40">
      <PageShell width={isForm ? "narrow" : "content"} className="py-8">
        <PageHeader
          purpose="functional"
          title={
            pathname === "/me/password"
              ? "修改密码"
              : pathname === "/me/email"
                ? "更换邮箱"
                : "设置"
          }
          backHref={isForm ? "/me#security" : undefined}
          backLabel="返回设置"
          actions={
            !isForm && user ? (
              <Link
                href={`/users/${user.id}`}
                className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] text-sm text-muted-foreground hover:text-foreground"
              >
                查看个人主页
              </Link>
            ) : null
          }
        />
        <div className="pb-8">{children}</div>
      </PageShell>
    </div>
  );
}
