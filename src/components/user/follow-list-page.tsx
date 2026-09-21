"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/api/hooks/use-user-profile";
import { useViewerScope } from "@/api/use-viewer-scope";
import { UserFollowList } from "@/components/user/user-follow-list";
import { EmptyState } from "@/components/shared/empty-state";
import type { FollowListKind } from "@/api/hooks/use-user-follow-list";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// 只记录当前访问者的两个页签坐标，不持久化用户资料或会话数据。
let scrollOwner: string | undefined;
const tabScroll = new Map<FollowListKind, number>();

export function FollowListPage({ userId, kind }: { userId: string; kind: FollowListKind }) {
  const { data: profile, isLoading } = useUserProfile(userId);
  const viewer = useViewerScope();
  const router = useRouter();
  const isOwner = viewer !== "anonymous" && viewer === userId;
  const restored = useRef<string | undefined>(undefined);
  const onReady = useCallback(() => {
    const scope = `${viewer}:${userId}`;
    if (scrollOwner !== scope) {
      tabScroll.clear();
      scrollOwner = scope;
    }
    const key = `${scope}:${kind}`;
    if (!isOwner || restored.current === key) return;
    restored.current = key;
    const top = tabScroll.get(kind) ?? 0;
    requestAnimationFrame(() => window.scrollTo({ top, behavior: "instant" }));
  }, [viewer, userId, kind, isOwner]);
  const counts = profile && !profile.isDeactivated ? profile._count : undefined;

  return <PageShell width="feed">
    <PageHeader backHref={`/users/${userId}`} backLabel="返回主页" purpose="functional"
      title={isOwner ? "我的关注与粉丝" : isLoading ? (kind === "following" ? "关注的人" : "粉丝")
        : kind === "following" ? `${profile?.username ?? ""} 关注的人` : `${profile?.username ?? ""} 的粉丝`} />
    {!isLoading && !profile ? <EmptyState title="用户不存在" />
      : isOwner ? <Tabs value={kind} onValueChange={(value) => {
        if (value !== "following" && value !== "followers") return;
        if (value === kind) return;
        tabScroll.set(kind, window.scrollY);
        router.push(`/users/${userId}/${value}`, { scroll: false });
      }}>
        <TabsList variant="line" className="sticky top-0 z-[var(--layer-sticky)] w-full justify-start bg-background" aria-label="关注与粉丝">
          <TabsTrigger value="following">关注{counts ? ` ${counts.following}` : ""}</TabsTrigger>
          <TabsTrigger value="followers">粉丝{counts ? ` ${counts.followers}` : ""}</TabsTrigger>
        </TabsList>
        <TabsContent value={kind}>
          <UserFollowList userId={userId} kind={kind} onReady={onReady} />
        </TabsContent>
      </Tabs> : <UserFollowList userId={userId} kind={kind} />}
  </PageShell>;
}
