"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  Menu,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Type,
  Users,
} from "lucide-react";
import { useAdminLogout, useAdminSession } from "@/api/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { adminLoginHref } from "@/lib/admin-session-url";
import { getApiErrorMessage } from "@/api/errors";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const navigationGroups = [
  {
    label: "运营管理",
    icon: SlidersHorizontal,
    items: [
      { href: "/station/announcements", label: "站内通知", icon: BellRing },
      {
        href: "/station/mobile-releases",
        label: "移动端版本",
        icon: Smartphone,
      },
      { href: "/station/text-fonts", label: "正文字体", icon: Type },
      { href: "/station/taxonomy", label: "分类与标签", icon: FolderTree },
    ],
  },
  {
    label: "举报与申诉",
    icon: ShieldAlert,
    items: [
      { href: "/station/cases", label: "举报处理", icon: ClipboardList },
      { href: "/station/appeals", label: "申诉复核", icon: BookOpenCheck },
    ],
  },
  {
    label: "系统管理",
    icon: LockKeyhole,
    items: [
      { href: "/station/operations", label: "运行设置", icon: Settings2 },
      {
        href: "/station/accounts",
        label: "管理员账号",
        icon: ShieldCheck,
        superOnly: true,
      },
      { href: "/station/audit", label: "操作日志", icon: ScrollText },
    ],
  },
] as const;

export function StationFrame({
  title,
  children,
  fullBleed = false,
}: {
  title: string;
  children: React.ReactNode;
  fullBleed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAdminSession();
  const logout = useAdminLogout();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationToggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (session.sessionStatus === "unauthenticated") {
      router.replace(
        session.reason === "logout"
          ? "/station"
          : adminLoginHref(window.location.pathname + window.location.search),
      );
    }
  }, [router, session.sessionStatus, session.reason]);

  if (session.sessionStatus === "unauthenticated" || !session.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted text-sm text-muted-foreground">
        {session.sessionStatus === "unavailable" ? (
          <div className="space-y-3 text-center">
            <p>暂时无法验证登录状态</p>
            <Button onClick={() => void session.refetch()}>重试</Button>
          </div>
        ) : (
          "正在验证登录状态…"
        )}
      </div>
    );
  }

  const administrator = session.data;
  const visibleGroups = navigationGroups.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        !("superOnly" in item) ||
        !item.superOnly ||
        administrator.user.role === "SUPER_ADMIN",
    ),
  }));
  const dashboardActive = pathname === "/station/dashboard";

  return (
    <div
      data-slot="station-shell"
      className="min-h-screen w-full min-w-0 overflow-x-hidden bg-muted/55 text-foreground"
    >
      <aside className="w-full bg-foreground text-background md:fixed md:inset-y-0 md:left-0 md:z-20 md:flex md:w-52 md:flex-col">
        <div className="flex items-center gap-2 border-b border-background/15 py-3 pl-4 pr-16 md:px-4">
          <Button
            ref={navigationToggle}
            type="button"
            variant="ghost"
            size="icon-compact"
            className="shrink-0 text-background hover:bg-background/10 md:hidden"
            aria-label={navigationOpen ? "收起管理导航" : "展开管理导航"}
            aria-expanded={navigationOpen}
            aria-controls="station-navigation"
            onClick={() => setNavigationOpen((open) => !open)}
          >
            <Menu />
          </Button>
          <Link href="/station/dashboard" className="flex items-center gap-3">
            <span>
              <span className="block font-sans text-base font-semibold">
                温油站管理后台
              </span>
            </span>
          </Link>
        </div>

        <div
          id="station-navigation"
          className={cn(
            "max-h-[calc(100dvh-3.5rem)] flex-col overflow-y-auto md:flex md:min-h-0 md:max-h-none md:flex-1",
            navigationOpen ? "flex" : "hidden",
          )}
          onClickCapture={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest("a[href]")
            )
              setNavigationOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && navigationOpen) {
              setNavigationOpen(false);
              navigationToggle.current?.focus();
            }
          }}
        >
          <nav
            inert={session.sessionStatus !== "authenticated"}
            aria-label="管理功能"
            className="flex-1 space-y-1 overflow-y-auto px-2 py-2"
          >
            <Link
              href="/station/dashboard"
              aria-current={dashboardActive ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-semibold transition-colors",
                dashboardActive
                  ? "bg-background text-foreground"
                  : "text-background/70 hover:bg-background/10 hover:text-background",
              )}
            >
              <Gauge className="size-4" />
              总览
            </Link>

            {[
              { href: "/station/users", label: "用户管理", icon: Users },
              { href: "/station/content", label: "内容管理", icon: LayoutList },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname.startsWith(href) ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-semibold",
                  pathname.startsWith(href)
                    ? "bg-background text-foreground"
                    : "text-background/70 hover:bg-background/10 hover:text-background",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
            {visibleGroups.map((group) => {
              const groupActive = group.items.some(
                (item) =>
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`),
              );
              const GroupIcon = group.icon;
              return (
                <Collapsible.Root
                  key={group.label}
                  defaultOpen
                  className="pt-1"
                >
                  <Collapsible.Trigger
                    className={cn(
                      "group flex h-10 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-semibold text-background/70 transition-colors hover:bg-background/10 hover:text-background",
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
                        const active =
                          pathname === item.href ||
                          pathname.startsWith(`${item.href}/`);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex h-9 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-semibold transition-colors",
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
              <p className="truncate text-sm font-bold">
                {administrator.user.username}
              </p>
              <p className="font-utility text-xs text-background/60">
                {administrator.user.role === "SUPER_ADMIN"
                  ? "超级管理员"
                  : "管理员"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-background hover:bg-background/10"
              disabled={logout.isPending}
              onClick={async () => {
                try {
                  await logout.mutateAsync();
                } catch (error) {
                  toast.error(getApiErrorMessage(error, "退出失败，请重试"));
                }
              }}
            >
              <LogOut />
              退出登录
            </Button>
          </div>
        </div>
      </aside>

      <div data-slot="station-content" className="min-w-0 md:pl-52">
        <header className="flex h-12 min-w-0 items-center justify-between border-b border-border bg-background px-4">
          <div>
            <h1 className="font-sans text-xl font-semibold tracking-tight">
              {title}
            </h1>
          </div>
          {session.sessionStatus === "checking" ? (
            <span role="status" className="text-sm text-muted-foreground">
              正在验证登录状态…
            </span>
          ) : null}
          {session.sessionStatus === "unavailable" ? (
            <div className="flex items-center gap-2 text-sm">
              <span role="alert">暂时无法验证登录状态</span>
              <Button size="compact" onClick={() => void session.refetch()}>
                重试
              </Button>
            </div>
          ) : null}
        </header>
        <main
          key={`${session.generation}:${administrator.user.id}`}
          inert={session.sessionStatus !== "authenticated"}
          data-slot="station-workspace"
          className={cn(
            "min-w-0 max-w-full",
            fullBleed ? "h-[calc(100vh-3rem)]" : "p-4",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
