"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/me", label: "个人资料" },
  { href: "/me/security", label: "账号与安全" },
];

const titles: Record<string, string> = {
  "/me": "个人资料",
  "/me/security": "账号与安全",
  "/me/password": "修改密码",
  "/me/email": "更换邮箱",
};

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isSettings = /^\/me(?:\/(?:appearance|privacy|security|password|email))?$/.test(pathname);
  if (!isSettings) return children;
  const activePath = pathname === "/me/security" || pathname === "/me/password" || pathname === "/me/email"
    ? "/me/security"
    : "/me";
  return (
    <PageShell width="content">
      <PageHeader
        purpose="functional"
        title={titles[pathname] ?? "个人资料"}
        backHref={pathname === "/me/password" || pathname === "/me/email" ? "/me/security" : undefined}
        backLabel="返回账号与安全"
        actions={user ? <Link href={`/users/${user.id}`} className="inline-flex min-h-10 items-center rounded-md text-sm text-muted-foreground outline-none hover:text-brand-strong focus-visible:ring-2 focus-visible:ring-ring">查看个人主页</Link> : null}
      />
      <nav aria-label="设置分区" className="mb-7 flex gap-8 border-b border-border">
        {sections.map(({ href, label }) => <Link key={href} href={href} aria-current={activePath === href ? "page" : undefined}
          className={cn("-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", activePath === href && "border-brand-strong font-semibold text-foreground")}>
          {label}
        </Link>)}
      </nav>
      <div className="pb-8">{children}</div>
    </PageShell>
  );
}
