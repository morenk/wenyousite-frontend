/** 关注/粉丝列表：头像 + 用户名链接 + 三态（复用 following / followers） */

"use client";

import Link from "next/link";
import { useUserFollowList, type FollowListKind } from "@/api/hooks/use-user-follow-list";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadError } from "@/components/shared/load-error";
import { LoadingState } from "@/components/shared/loading-state";
import { LevelBadge } from "@/components/shared/level-badge";

interface UserFollowListProps {
  userId: string;
  kind: FollowListKind;
}

export function UserFollowList({ userId, kind }: UserFollowListProps) {
  const { data: users, isLoading, isError, refetch } = useUserFollowList(userId, kind);

  if (isLoading) {
    return <LoadingState label="" className="min-h-0 py-16" />;
  }

  if (isError) {
    return <LoadError title="加载失败" onRetry={() => void refetch()} className="py-16" />;
  }

  if (!users || users.length === 0) {
    return <EmptyState title={kind === "following" ? "还没有关注任何人" : "还没有粉丝"} />;
  }

  return (
    <div className="w-full space-y-3">
      {users.map((user) => (
        <Link
          key={user.id}
          href={`/users/${user.id}`}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-accent/20"
        >
          <UserAvatar name={user.username} src={user.avatar} className="h-10 w-10" />
          <span className="text-sm font-medium text-foreground">
            {user.username}
          </span>
          <LevelBadge level={user.level} />
        </Link>
      ))}
    </div>
  );
}
