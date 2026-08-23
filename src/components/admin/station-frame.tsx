"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  BellRing,
  BookOpenCheck,
  ChevronDown,
  ClipboardList,
  FolderTree,
  Gauge,
  LayoutList,
  LockKeyhole,
  LogOut,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useAdminLogout, useAdminSession } from "@/api/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigationGroups = [
  {
    label: "内容治理",
    icon: LayoutList,
    items: [
      { href: "/station/cases", label: "案件队列", icon: ClipboardList },
      { href: "/station/content", label: "内容处置", icon: ShieldAlert },
      { href: "/station/appeals", label: "申诉复核", icon: BookOpenCheck },
      { href: "/station/users", label: "用户与处罚", icon: Users },
    ],
  },
  {
    label: "运营配置",
    icon: SlidersHorizontal,
    items: [
      { href: "/station/announcements", label: "站内通知", icon: BellRing },
      { href: "/station/taxonomy", label: "分类与标签", icon: FolderTree },
      { href: "/station/operations", label: "运行与开关", icon: Settings2 },
    ],
  },
  {
    label: "安全与权限",
    icon: LockKeyhole,
    items: [
      { href: "/station/accounts", label: "站务账号", icon: ShieldCheck, superOnly: true },
      { href: "/station/audit", label: "决定轨迹", icon: ScrollText },
    ],
  },
] as const;

export function StationFrame({
  title,
  eyebrow,
  children,
  fullBleed = false,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  fullBleed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAdminSession();
  const logout = useAdminLogout();

  useEffect(() => {
    if (session.isError) router.replace("/station");
  }, [router, session.isError]);

  if (!session.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted text-sm text-muted-foreground">
        正在核验站务会话…
      </div>
    );
  }

  const visibleGroups = navigationGroups.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !("superOnly" in item) || !item.superOnly || session.data.user.role === "SUPER_ADMIN",
    ),
  }));
  const dashboardActive = pathname === "/station/dashboard";

  return (
    <div
      data-slot="station-shell"
      className="min-h-screen w-full min-w-0 overflow-x-hidden bg-muted/55 text-foreground"
    >
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-foreground text-background">
        <div className="border-b border-background/15 px-6 py-5">
          <Link href="/station/dashboard" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gauge className="size-5" />
            </span>
            <span>
              <span className="block font-display text-lg font-medium">温油站务台</span>
              <span className="block font-utility text-[0.6875rem] font-bold tracking-[0.14em] text-background/60 uppercase">
                站务工作区
              </span>
            </span>
          </Link>
        </div>

        <nav aria-label="站务功能" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <Link
            href="/station/dashboard"
            aria-current={dashboardActive ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
              dashboardActive
                ? "bg-background text-foreground"
                : "text-background/70 hover:bg-background/10 hover:text-background",
            )}
          >
            <Gauge className="size-4" />
            站务总览
          </Link>

          {visibleGroups.map((group) => {
            const groupActive = group.items.some(
              (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
            );
            const GroupIcon = group.icon;
            return (
              <Collapsible.Root key={group.label} defaultOpen={groupActive} className="pt-1">
                <Collapsible.Trigger
                  className={cn(
                    "group flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-background/70 transition-colors hover:bg-background/10 hover:text-background",
                    groupActive && "text-background",
                  )}
                >
                  <GroupIcon className="size-4" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
                </Collapsible.Trigger>
                <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] data-[closed]:h-0">
                  <div className="ml-5 space-y-1 border-l border-background/20 py-1 pl-2">
                    {group.items.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
                            active
                              ? "bg-background text-foreground"
                              : "text-background/65 hover:bg-background/10 hover:text-background",
                          )}
                        >
                          <Icon className="size-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </Collapsible.Panel>
              </Collapsible.Root>
            );
          })}
        </nav>

        <div className="border-t border-background/15 p-4">
          <div className="mb-3 px-2">
            <p className="truncate text-sm font-bold">{session.data.user.username}</p>
            <p className="font-utility text-xs text-background/60">
              {session.data.user.role === "SUPER_ADMIN" ? "超级管理员" : "管理员"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-background hover:bg-background/10"
            disabled={logout.isPending}
            onClick={async () => {
              await logout.mutateAsync();
              router.replace("/station");
            }}
          >
            <LogOut />退出站务台
          </Button>
        </div>
      </aside>

      <div data-slot="station-content" className="min-w-0 pl-60">
        <header className="flex h-[4.75rem] min-w-0 items-center justify-between border-b border-border bg-background px-7">
          <div>
            <p className="font-utility text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
              {eyebrow}
            </p>
            <h1 className="font-display text-2xl font-medium tracking-tight">{title}</h1>
          </div>
          <p className="border-l-2 border-success pl-3 font-utility text-xs font-bold text-success">
            安全会话已连接
          </p>
        </header>
        <main
          data-slot="station-workspace"
          className={cn(
            "min-w-0 max-w-full",
            fullBleed ? "h-[calc(100vh-4.75rem)]" : "p-6",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
