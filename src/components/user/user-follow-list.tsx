/** 关注/粉丝列表：头像 + 用户名链接 + 三态（复用 following / followers） */

"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useUserFollowList, type FollowListKind } from "@/api/hooks/use-user-follow-list";
import { getImageUrlBySize } from "@/lib/upload-image";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

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
        <EmptyState title="加载失败" description="请稍后重试" />
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
    <div className="space-y-3">
      {users.map((user) => (
        <Link
          key={user.id}
          href={`/users/${user.id}`}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-md"
        >
          <Avatar name={user.username} src={user.avatar} />
          <span className="text-sm font-medium text-foreground">
            {user.username}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** 头像：有 URL 用缩略图，无则显示用户名首字符 */
function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={getImageUrlBySize(src, "thumb")}
        alt={name}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
