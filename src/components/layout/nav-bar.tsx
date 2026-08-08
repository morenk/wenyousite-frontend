/** 全局桌面导航：宽屏显示完整侧栏，1024px 显示图标轨道。 */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Bookmark,
  Compass,
  LogIn,
  LogOut,
  MessageCircle,
  Images,
  Search,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useLogout } from "@/api/hooks/use-auth-actions";
import { useDirectUnreadCount } from "@/api/hooks/use-direct-conversations";
import { useUnreadCount } from "@/api/hooks/use-unread-count";
import { UserAvatar } from "@/components/shared/user-avatar";
import { PublishMenu } from "@/components/layout/publish-menu";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  count?: number;
  accountShortcut?: boolean;
};

export function NavBar({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const logoutRequest = useLogout();
  const { data: unreadCount } = useUnreadCount(user?.id);
  const { data: directUnread } = useDirectUnreadCount(user?.id);

  const items: NavItem[] = [
    { href: "/", label: "发现", icon: Compass, match: (path) => path === "/" || path.startsWith("/tags/") },
    { href: "/moments", label: "动态", icon: Images, match: (path) => path.startsWith("/moments") },
    { href: "/search", label: "搜索", icon: Search, match: (path) => path.startsWith("/search") },
    ...(user ? [
      { href: "/notifications", label: "通知", icon: Bell, match: (path: string) => path.startsWith("/notifications"), count: unreadCount ?? 0, accountShortcut: true },
      { href: "/messages", label: "私聊", icon: MessageCircle, match: (path: string) => path.startsWith("/messages"), count: directUnread?.total ?? 0, accountShortcut: true },
      { href: "/bookmarks", label: "收藏", icon: Bookmark, match: (path: string) => path.startsWith("/bookmarks"), accountShortcut: true },
    ] : []),
  ];

  const handleLogout = async () => {
    try {
      await logoutRequest.mutateAsync();
    } catch {
      toast.error("退出失败，请检查网络后重试");
      return;
    }
    logout();
    toast.success("已退出登录");
    router.replace("/");
    router.refresh();
  };

  return (
    <aside
      className="sticky top-0 z-40 flex h-screen min-h-[36rem] flex-col py-4"
      aria-label="全局导航"
      data-compact={compact ? "true" : "false"}
    >
      <Link
        href="/"
        aria-label="温油站首页"
        className={cn(
          "group flex h-14 items-center justify-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          !compact && "xl:justify-start xl:px-3",
        )}
      >
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary font-display text-xl font-bold text-primary-foreground transition-transform duration-[var(--motion-standard)] group-hover:-rotate-2">
          温
          <span className="absolute -right-1 top-1 size-2.5 rounded-full border-2 border-white bg-secondary" aria-hidden="true" />
        </span>
        <span className={cn(
          "ml-3 hidden font-display text-xl font-bold tracking-wide text-foreground",
          !compact && "xl:block",
        )}>温油站</span>
      </Link>

      {user ? <PublishMenu userId={user.id} compact={compact} /> : null}

      <nav className="mt-5 grid gap-1.5" aria-label="主要页面">
        {items.map((item) => (
          <RailLink
            key={item.href}
            item={item}
            active={item.match(pathname)}
            compact={compact}
            hideOnWide={!!item.accountShortcut}
          />
        ))}
      </nav>

      <div className={cn(
        "mt-auto grid gap-2 border-t border-border pt-4",
        !user && "xl:hidden",
      )}>
        {user ? (
          <>
            <Link
              href={`/users/${user.id}`}
              aria-label={user.username}
              title={user.username}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                !compact && "xl:justify-start xl:gap-3 xl:px-2.5",
                "xl:hidden",
                pathname.startsWith(`/users/${user.id}`) && "bg-accent/55 text-foreground",
              )}
            >
              <UserAvatar name={user.username} src={user.avatar ?? null} className="size-8" textClassName="text-xs" />
              <span className={cn(
                "hidden min-w-0 flex-1 truncate text-sm font-bold",
                !compact && "xl:block",
              )}>{user.username}</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                "flex min-h-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                !compact && "xl:justify-start xl:gap-3 xl:px-3",
              )}
              title="退出"
            >
              <LogOut className="size-4" />
              <span className={cn("hidden text-sm font-medium", !compact && "xl:inline")}>退出</span>
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className={cn(
              "flex min-h-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              !compact && "xl:gap-3",
            )} title="登录">
              <LogIn className="size-5" />
              <span className={cn("hidden text-sm font-semibold", !compact && "xl:inline")}>登录</span>
            </Link>
            <Link
              href="/register"
              aria-label="注册"
              title="注册"
              className={cn(
                "flex min-h-11 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/80",
                !compact && "xl:px-3",
              )}
            >
              <UserPlus className={cn("size-5", !compact && "xl:hidden")} />
              <span className={cn("hidden text-sm font-bold", !compact && "xl:inline")}>注册</span>
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}

function RailLink({
  item,
  active,
  compact,
  hideOnWide,
}: {
  item: NavItem;
  active: boolean;
  compact: boolean;
  hideOnWide: boolean;
}) {
  const Icon = item.icon;
  const count = item.count ?? 0;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      title={item.label}
      className={cn(
        "group relative flex min-h-11 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color] duration-[var(--motion-fast)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        !compact && "xl:justify-start xl:gap-3 xl:px-3",
        hideOnWide && "xl:hidden",
        active && "bg-accent/60 font-bold text-foreground",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-2 left-0 w-[3px] origin-center rounded-full bg-brand-strong transition-transform duration-[var(--motion-standard)]",
          active ? "scale-y-100" : "scale-y-0",
        )}
        aria-hidden="true"
      />
      <span className="relative">
        <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
        {count > 0 ? (
          <span className="absolute -right-2.5 -top-2 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-utility text-[0.625rem] font-bold leading-4 text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </span>
      <span className={cn("hidden text-sm", !compact && "xl:inline")}>{item.label}</span>
    </Link>
  );
}
