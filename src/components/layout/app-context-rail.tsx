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
import { useThreadCategoriesContext } from "@/components/thread/thread-categories-provider";
import { ThreadCategoryMarker } from "@/components/thread/thread-category";
import { useUnreadCounts } from "@/components/layout/unread-counts-context";

export function AppContextRail() {
  const { user } = useAuth();
  const { data: wallet } = useWallet(user?.id);
  const { notificationCount, directMessageCount } = useUnreadCounts();
  const { categories } = useThreadCategoriesContext();

  return (
    <aside
      aria-label="快捷信息"
      className="sticky top-0 hidden h-screen overflow-y-auto py-5 xl:block"
    >
      {user ? (
        <Panel className="overflow-hidden" padding="none">
          <div className="h-1 bg-primary" aria-hidden="true" />
          <div className="p-4">
            <Link
              href={`/users/${user.id}`}
              className="group flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <UserAvatar name={user.username} src={user.avatar} className="size-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-foreground">{user.username}</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>

            <Link
              href="/wallet"
              className="mt-4 flex items-center justify-between rounded-lg bg-primary/55 px-3 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/75"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Wallet className="size-4" />
                我的温油
              </span>
              <span className="font-utility font-bold tabular-nums">
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
              <ContextLink href="/me" icon="action.settings" label="资料与设置" />
            </nav>
          </div>
        </Panel>
      ) : (
        <Panel className="overflow-hidden" padding="none">
          <div className="h-1 bg-primary" aria-hidden="true" />
          <div className="p-5">
            <p className="font-display text-xl font-bold text-foreground">登录温油站</p>
            <div className="mt-4 grid gap-2">
              <Link href="/register" className={cn(buttonVariants(), "w-full")}>注册</Link>
              <Link href="/login" className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>登录</Link>
            </div>
          </div>
        </Panel>
      )}

      <Panel className="mt-4" padding="compact">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-base font-bold text-foreground">按玩法发现</h2>
          <Link href="/" className="text-xs font-semibold text-brand-strong hover:underline">全部</Link>
        </div>
        <nav className="grid gap-1" aria-label="玩法分类">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/?category=${encodeURIComponent(category.slug)}`}
              className="group flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground"
            >
              <ThreadCategoryMarker category={category.slug} className="size-2.5 rounded-full ring-4 ring-white" />
              <span className="flex-1">{category.name}</span>
              <ChevronRight className="size-4 opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
          ))}
        </nav>
      </Panel>

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
      className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <WenyouIcon id={icon} className="size-4" />
      <span className="flex-1">{label}</span>
      {count > 0 ? (
        <span className="min-w-5 rounded-full bg-destructive px-1.5 text-center font-utility text-[0.625rem] font-bold leading-5 text-destructive-foreground">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
