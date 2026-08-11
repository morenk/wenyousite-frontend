/** 关注/粉丝列表：头像 + 用户名链接 + 三态（复用 following / followers） */

"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useUserFollowList, type FollowListKind } from "@/api/hooks/use-user-follow-list";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { LevelBadge } from "@/components/shared/level-badge";

interface UserFollowListProps {
  userId: string;
  kind: FollowListKind;
}

export function UserFollowList({ userId, kind }: UserFollowListProps) {
  const { data: users, isLoading, isError, refetch } = useUserFollowList(userId, kind);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <EmptyState title="加载失败" />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    );
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
