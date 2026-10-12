/** 全局桌面导航：社区与工作区共用图标轨道，账户快捷入口由右栏承载。 */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { BRAND_NAME } from "@wenyousite/foundation/brand";
import { NAVIGATION_ICONS, NAVIGATION_LABELS } from "@wenyousite/foundation/navigation";

import { useLogout } from "@/api/hooks/use-auth-actions";
import { UserAvatar } from "@/components/shared/user-avatar";
import { WenyouIcon, type WenyouIconId } from "@/components/ui/wenyou-icon";
import { PublishMenu } from "@/components/layout/publish-menu";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { BrandTitleMark } from "@/components/ui/brand-title-mark";
import { Tooltip } from "@/components/ui/tooltip";
import { ThemeMenu } from "@/components/layout/theme-menu";

type NavItem = {
  href: string;
  label: string;
  icon: WenyouIconId;
  match: (pathname: string) => boolean;
};

export function NavBar({
  compact = false,
}: {
  compact?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const logoutRequest = useLogout();

  const items: NavItem[] = [
    { href: "/", label: NAVIGATION_LABELS.discover, icon: NAVIGATION_ICONS.discover, match: (path) => path === "/" || path.startsWith("/tags/") },
    { href: "/moments", label: NAVIGATION_LABELS.moments, icon: NAVIGATION_ICONS.moments, match: (path) => path.startsWith("/moments") },
    { href: "/search", label: NAVIGATION_LABELS.search, icon: NAVIGATION_ICONS.search, match: (path) => path.startsWith("/search") },
    { href: "/tools", label: "温油工具箱", icon: "content.layers", match: (path) => path === "/tools" || path.startsWith("/tools/") },
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
      className="sticky top-0 z-[var(--layer-chrome)] flex h-screen min-h-0 flex-col overflow-y-auto py-4 [&>*]:shrink-0"
      aria-label="全局导航"
      data-compact={compact ? "true" : "false"}
    >
      <Tooltip content={`${BRAND_NAME}首页`} side="right">
      <Link
        href="/"
        aria-label={`${BRAND_NAME}首页`}
        className={cn(
          "group flex h-14 items-center justify-center rounded-[var(--radius-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
          !compact && "xl:justify-start xl:px-3",
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center">
          <BrandTitleMark size={40} priority />
        </span>
        <span className={cn(
          "ml-3 hidden font-display text-xl font-medium tracking-wide text-foreground",
          !compact && "xl:block",
        )}>{BRAND_NAME}</span>
      </Link>
      </Tooltip>

      {user ? <PublishMenu userId={user.id} compact={compact} /> : null}

      <nav className="mb-5 mt-5 grid gap-1.5" aria-label="主要页面">
        {items.map((item) => (
          <RailLink
            key={item.href}
            item={item}
            active={item.match(pathname)}
            compact={compact}
          />
        ))}
      </nav>

      <div className="mt-auto grid gap-2 border-t border-border pt-4">
        <ThemeMenu compact={compact} />
        <div className={cn("grid gap-2", !user && !compact && "xl:hidden")}>
          {user ? (
            <>
              <Tooltip content="个人主页" side="right">
              <Link
                href={`/users/${user.id}`}
                aria-label={user.username}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
                  !compact && "xl:justify-start xl:gap-3 xl:px-2.5",
                  !compact && "xl:hidden",
                  pathname.startsWith(`/users/${user.id}`) && "bg-accent/55 text-foreground",
                )}
              >
                <UserAvatar name={user.username} src={user.avatar ?? null} display={user.avatarDisplay} className="size-8" textClassName="text-xs" />
                <span className={cn(
                  "hidden min-w-0 flex-1 truncate text-sm font-bold",
                  !compact && "xl:block",
                )}>{user.username}</span>
              </Link>
              </Tooltip>
              <Tooltip content="退出" side="right">
              <button
                type="button"
                onClick={handleLogout}
                className={cn(
                  "flex min-h-10 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
                  !compact && "xl:justify-start xl:gap-3 xl:px-3",
                )}
                aria-label="退出"
              >
                <WenyouIcon id="action.logout" className="size-4" />
                <span className={cn("hidden text-sm font-medium", !compact && "xl:inline")}>退出</span>
              </button>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip content="登录" side="right">
              <Link href="/login" className={cn(
                "flex min-h-11 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
                !compact && "xl:gap-3",
              )} aria-label="登录">
                <WenyouIcon id="action.login" className="size-5" />
                <span className={cn("hidden text-sm font-semibold", !compact && "xl:inline")}>登录</span>
              </Link>
              </Tooltip>
              <Tooltip content="注册" side="right">
              <Link
                href="/register"
                aria-label="注册"
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-action-primary text-action-primary-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--action-primary)_86%,var(--brand-strong))]",
                  !compact && "xl:px-3",
                )}
              >
                <WenyouIcon id="action.follow" className={cn("size-5", !compact && "xl:hidden")} />
                <span className={cn("hidden text-sm font-bold", !compact && "xl:inline")}>注册</span>
              </Link>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function RailLink({
  item,
  active,
  compact,
}: {
  item: NavItem;
  active: boolean;
  compact: boolean;
}) {
  return (
    <Tooltip content={item.label} side="right">
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={cn(
        "group relative flex min-h-11 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-[background-color,color] duration-[var(--motion-fast)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
        !compact && "xl:justify-start xl:gap-3 xl:px-3",
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
        <WenyouIcon id={item.icon} className="size-5" />
      </span>
      <span className={cn("hidden text-sm", !compact && "xl:inline")}>{item.label}</span>
    </Link>
    </Tooltip>
  );
}
