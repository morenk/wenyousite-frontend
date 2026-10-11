"use client";

import Link from "next/link";
import { NAVIGATION_ICONS, NAVIGATION_LABELS } from "@wenyousite/foundation/navigation";
import { ChevronRight, Wallet } from "lucide-react";

import { useWallet } from "@/api/hooks/use-economy";
import { UserAvatar } from "@/components/shared/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { WenyouIcon, type WenyouIconId } from "@/components/ui/wenyou-icon";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { formatWenyou } from "@/lib/wenyou";
import { useUnreadCounts } from "@/components/layout/unread-counts-context";
import { UnreadCountBadge } from "@/components/ui/unread-count-badge";

export function AppContextRail() {
  const { user } = useAuth();
  const { data: wallet } = useWallet(user?.id);
  const { notificationCount, directMessageCount } = useUnreadCounts();

  return (
    <aside
      aria-label="快捷信息"
      className="sticky top-0 hidden h-screen overflow-y-auto py-8 xl:block"
    >
      {user ? (
        <Panel className="overflow-hidden rounded-[var(--radius-card)] border-0" padding="none">
          <div className="p-5">
            <Link
              href={`/users/${user.id}`}
              className="group flex items-center gap-3 rounded-[var(--radius-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <UserAvatar name={user.username} src={user.avatar} display={user.avatarDisplay} className="size-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{user.username}</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>

            <Link
              href="/wallet"
              className="mt-4 flex items-center justify-between rounded-[var(--radius-control)] bg-muted/60 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Wallet className="size-4" />
                我的温油
              </span>
              <span className="font-utility font-medium tabular-nums">
                {wallet ? `${formatWenyou(wallet.balance)} 升` : "—"}
              </span>
            </Link>

            <nav className="mt-3 grid gap-1" aria-label="账户快捷入口">
              <ContextLink
                href="/notifications"
                icon={NAVIGATION_ICONS.notifications}
                label={NAVIGATION_LABELS.notifications}
                count={notificationCount}
              />
              <ContextLink
                href="/messages"
                icon={NAVIGATION_ICONS.directMessages}
                label={NAVIGATION_LABELS.directMessages}
                count={directMessageCount}
              />
              <ContextLink href="/bookmarks" icon={NAVIGATION_ICONS.bookmarks} label={NAVIGATION_LABELS.bookmarks} />
              <ContextLink href="/me" icon="action.settings" label="设置" />
            </nav>
          </div>
        </Panel>
      ) : (
        <Panel className="overflow-hidden rounded-[var(--radius-card)] border-0" padding="none">
          <div className="p-5">
            <p className="text-base font-semibold text-foreground">登录温油站</p>
            <div className="mt-4 grid gap-2">
              <Link href="/register" className={cn(buttonVariants(), "w-full")}>注册</Link>
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "w-full")}>登录</Link>
            </div>
          </div>
        </Panel>
      )}

    </aside>
  );
}

function ContextLink({
  href,
  icon,
  label,
  count = 0,
}: {
  href: string;
  icon: WenyouIconId;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-label={count > 0 ? `${label}，${count} 条未读` : label}
      className="flex min-h-9 items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <WenyouIcon id={icon} className="size-4" />
      <span className="flex-1">{label}</span>
      <UnreadCountBadge count={count} />
    </Link>
  );
}
