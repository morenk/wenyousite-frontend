"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/me", label: "基本资料" },
  { href: "/me/appearance", label: "主页外观" },
  { href: "/me/privacy", label: "隐私设置" },
  { href: "/me/security", label: "账号安全" },
];

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const isSettings = /^\/me(?:\/(?:appearance|privacy|security|password|email))?$/.test(pathname);
  useEffect(() => {
    if (pathname === "/me" && window.location.hash === "#profile-appearance") router.replace("/me/appearance");
  }, [pathname, router]);
  if (!isSettings) return children;
  const activePath = pathname === "/me/password" || pathname === "/me/email" ? "/me/security" : pathname;
  return (
    <PageShell width="workspace">
      <PageHeader purpose="functional" title="资料与设置" actions={user ? <Link href={`/users/${user.id}`} className="inline-flex min-h-10 items-center rounded-md text-sm text-muted-foreground outline-none hover:text-brand-strong focus-visible:ring-2 focus-visible:ring-ring">查看个人主页</Link> : null} />
      <div className="grid grid-cols-[15rem_minmax(0,1fr)] items-start gap-6">
        <nav aria-label="设置分区" className="sticky top-5 border-r border-border pr-5">
          {sections.map(({ href, label }) => <Link key={href} href={href} aria-current={activePath === href ? "page" : undefined}
            className={cn("flex min-h-11 items-center border-l-2 border-transparent px-4 py-2 text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", activePath === href && "border-brand-strong bg-primary/30 font-semibold text-foreground")}>
            {label}
          </Link>)}
        </nav>
        <div className="min-w-0 w-full max-w-content pb-8">{children}</div>
      </div>
    </PageShell>
  );
}

export function SettingsTitle({ children }: { children: ReactNode }) {
  return <h2 data-slot="settings-title" className="mb-6 border-b border-border pb-4 font-sans font-semibold [font-size:var(--type-section-title-size)] [line-height:var(--type-section-title-line-height)]">{children}</h2>;
}
