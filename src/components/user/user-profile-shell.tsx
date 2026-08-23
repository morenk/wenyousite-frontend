"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useUserProfile, type ActiveUserPublic } from "@/api/hooks/use-user-profile";
import { PageRouteFallback } from "@/components/layout/page-route-fallback";
import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type UserProfileTab = "overview" | "moments" | "threads" | "bookmarks";

export interface UserProfilePageContext {
  profile: ActiveUserPublic;
  isSelf: boolean;
  canViewRecentReplies: boolean;
  canViewPlayedThreads: boolean;
  canViewBookmarks: boolean;
}

interface UserProfileShellProps {
  userId: string;
  children: ReactNode;
}

const UserProfilePageContext = createContext<UserProfilePageContext | null>(null);

const baseTabs: Array<{ value: Exclude<UserProfileTab, "bookmarks">; label: string; path: string }> = [
  { value: "overview", label: "概览", path: "" },
  { value: "moments", label: "动态", path: "/moments" },
  { value: "threads", label: "帖子", path: "/threads" },
];

/** 读取由资料页共享 Layout 提供的用户资料与查看权限。 */
export function useUserProfilePageContext() {
  const context = useContext(UserProfilePageContext);
  if (!context) {
    throw new Error("useUserProfilePageContext 必须在 UserProfileShell 内使用");
  }
  return context;
}

function resolveActiveTab(pathname: string, userId: string): UserProfileTab {
  const profilePath = `/users/${userId}`;
  if (pathname === `${profilePath}/moments`) return "moments";
  if (pathname === `${profilePath}/threads`) return "threads";
  if (pathname === `${profilePath}/bookmarks`) return "bookmarks";
  return "overview";
}

/** 个人资料各 Tab 共享且不会在切换时卸载的资料头部、权限与吸顶导航。 */
export function UserProfileShell({ userId, children }: UserProfileShellProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { data: profile, isLoading, error, refetch } = useUserProfile(userId);

  if (isLoading) return <PageRouteFallback variant="profile" />;

  if (error || !profile) {
    return (
      <PageShell className="py-12">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <AlertCircle className="size-10 text-muted-foreground" aria-hidden="true" />
              <EmptyState title="用户不存在" description="该用户可能已注销或不存在" />
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (profile.isDeactivated) {
    return (
      <PageShell className="py-12">
        <Card>
          <CardContent className="pt-6">
            <EmptyState title="已注销用户" />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const isSelf = user?.id === userId;
  const context: UserProfilePageContext = {
    profile,
    isSelf,
    canViewRecentReplies: isSelf || profile.showRecentReplies,
    canViewPlayedThreads: isSelf || profile.showPlayerBadges,
    canViewBookmarks: isSelf || profile.showBookmarks,
  };
  const tabs: Array<{ value: UserProfileTab; label: string; path: string }> = context.canViewBookmarks
    ? [...baseTabs, { value: "bookmarks", label: "收藏", path: "/bookmarks" }]
    : baseTabs;
  const activeTab = resolveActiveTab(pathname, userId);

  return (
    <UserProfilePageContext.Provider value={context}>
      <PageShell>
        <div className="space-y-5">
          <UserProfileCard user={profile} />
          <nav
            aria-label="个人资料分类"
            className="sticky top-2 z-[var(--layer-sticky)] rounded-2xl border border-border bg-card/95 px-2 backdrop-blur-md"
          >
            <div className={cn("grid w-full", tabs.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
              {tabs.map((tab) => {
                const active = activeTab === tab.value;
                return (
                  <Link
                    key={tab.value}
                    href={`/users/${userId}${tab.path}`}
                    prefetch
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-12 min-w-0 items-center justify-center px-1 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring/30 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity sm:px-4 sm:text-sm sm:after:inset-x-4",
                      active && "text-foreground after:opacity-100",
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </nav>
          <div data-slot="profile-tab-content">{children}</div>
        </div>
      </PageShell>
    </UserProfilePageContext.Provider>
  );
}
