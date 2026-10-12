"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION_ICONS, NAVIGATION_LABELS } from "@wenyousite/foundation/navigation";
import { ChevronRight, Wallet } from "lucide-react";

import { useWallet } from "@/api/hooks/use-economy";
import { UserAvatar } from "@/components/shared/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Tooltip } from "@/components/ui/tooltip";
import { WenyouIcon, type WenyouIconId } from "@/components/ui/wenyou-icon";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { formatWenyou } from "@/lib/wenyou";
import { useUnreadCounts } from "@/components/layout/unread-counts-context";
import { UnreadCountBadge } from "@/components/ui/unread-count-badge";

const focusStyle = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40";

export function AppContextRail() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { data: wallet } = useWallet(user?.id);
  const { notificationCount, directMessageCount } = useUnreadCounts();
  const balance = wallet ? `${formatWenyou(wallet.balance)} 升` : "—";

  return (
    <aside aria-label="快捷信息" className="sticky top-0 h-screen overflow-y-auto py-8">
      <Panel className="overflow-hidden rounded-[var(--radius-card)] border-0 bg-transparent lg:bg-card" padding="none">
        <div className="p-1 sm:p-2 lg:p-5">
          {user ? <>
            <Tooltip content="个人主页" side="left">
              <Link href={`/users/${user.id}`} aria-label={user.username}
                aria-current={pathname === `/users/${user.id}` ? "page" : undefined}
                className={cn("group flex min-h-11 items-center justify-center gap-3 rounded-[var(--radius-control)] lg:justify-start", focusStyle,
                  pathname === `/users/${user.id}` && "bg-accent/55 text-foreground")}>
                <UserAvatar name={user.username} src={user.avatar} display={user.avatarDisplay} className="size-9 lg:size-11" />
                <span className="hidden min-w-0 flex-1 truncate font-semibold text-foreground lg:block">{user.username}</span>
                <ChevronRight className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 lg:block" />
              </Link>
            </Tooltip>
            <Tooltip content={`我的温油：${balance}`} side="left">
              <Link href="/wallet" aria-label={`我的温油，${balance}`} aria-current={pathname === "/wallet" ? "page" : undefined}
                className={cn("mt-3 flex min-h-11 items-center justify-center rounded-[var(--radius-control)] text-sm text-foreground transition-colors hover:bg-accent lg:mt-4 lg:justify-between lg:bg-muted/60 lg:px-3 lg:py-2.5", focusStyle,
                  pathname === "/wallet" && "bg-accent/60")}>
                <span className="flex items-center gap-2 font-semibold"><Wallet className="size-5 lg:size-4" /><span className="hidden lg:inline">我的温油</span></span>
                <span className="hidden font-utility font-medium tabular-nums lg:inline">{balance}</span>
              </Link>
            </Tooltip>
            <nav className="mt-3 grid gap-1" aria-label="账户快捷入口">
              <ContextLink href="/notifications" icon={NAVIGATION_ICONS.notifications} label={NAVIGATION_LABELS.notifications} count={notificationCount} />
              <ContextLink href="/messages" icon={NAVIGATION_ICONS.directMessages} label={NAVIGATION_LABELS.directMessages} count={directMessageCount} />
              <ContextLink href="/bookmarks" icon={NAVIGATION_ICONS.bookmarks} label={NAVIGATION_LABELS.bookmarks} />
              <ContextLink href="/me" icon="action.settings" label="设置" />
            </nav>
          </> : <>
            <p className="hidden text-base font-semibold text-foreground lg:block">登录温油站</p>
            <div className="grid gap-2 lg:mt-4">
              <Tooltip content="注册" side="left">
                <Link href="/register" aria-label="注册" className={cn(buttonVariants(), "min-h-11 w-full px-2", focusStyle)}>
                  <WenyouIcon id="action.follow" className="size-5 lg:hidden" /><span className="hidden lg:inline">注册</span>
                </Link>
              </Tooltip>
              <Tooltip content="登录" side="left">
                <Link href="/login" aria-label="登录" className={cn(buttonVariants({ variant: "ghost" }), "min-h-11 w-full px-2", focusStyle)}>
                  <WenyouIcon id="action.login" className="size-5 lg:hidden" /><span className="hidden lg:inline">登录</span>
                </Link>
              </Tooltip>
            </div>
          </>}
        </div>
      </Panel>
    </aside>
  );
}

function ContextLink({ href, icon, label, count = 0 }: {
  href: string;
  icon: WenyouIconId;
  label: string;
  count?: number;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Tooltip content={label} side="left">
      <Link href={href} aria-current={active ? "page" : undefined}
        aria-label={count > 0 ? `${label}，${count} 条未读` : label}
        className={cn("relative flex min-h-11 items-center justify-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:min-h-9 lg:justify-start", focusStyle,
          active && "bg-accent/60 font-semibold text-foreground")}>
        <WenyouIcon id={icon} className="size-5 shrink-0 lg:size-4" />
        <span className="hidden flex-1 lg:block">{label}</span>
        <UnreadCountBadge count={count} className="absolute right-0 top-0 lg:static" />
      </Link>
    </Tooltip>
  );
}
