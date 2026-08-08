/** 关注/粉丝子页面主体：用户名标题 + 返回链接 + 列表 */

"use client";

import { useUserProfile } from "@/api/hooks/use-user-profile";
import { UserFollowList } from "@/components/user/user-follow-list";
import { EmptyState } from "@/components/shared/empty-state";
import type { FollowListKind } from "@/api/hooks/use-user-follow-list";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

interface FollowListPageProps {
  userId: string;
  kind: FollowListKind;
}

export function FollowListPage({ userId, kind }: FollowListPageProps) {
  const { data: profile, isLoading } = useUserProfile(userId);
  const isFollowing = kind === "following";

  return (
    <PageShell width="feed">
      <PageHeader
        backHref={`/users/${userId}`}
        backLabel="返回主页"
        title={isLoading
          ? (isFollowing ? "关注的人" : "粉丝")
          : isFollowing
            ? `${profile?.username ?? ""} 关注的人`
            : `${profile?.username ?? ""} 的粉丝`}
      />

      {!isLoading && !profile ? (
        <EmptyState title="用户不存在" />
      ) : (
        <UserFollowList userId={userId} kind={kind} />
      )}
    </PageShell>
  );
}
