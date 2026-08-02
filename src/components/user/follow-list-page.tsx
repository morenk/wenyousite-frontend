/** 关注/粉丝子页面主体：用户名标题 + 返回链接 + 列表 */

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useUserProfile } from "@/api/hooks/use-user-profile";
import { UserFollowList } from "@/components/user/user-follow-list";
import { EmptyState } from "@/components/shared/empty-state";
import type { FollowListKind } from "@/api/hooks/use-user-follow-list";

interface FollowListPageProps {
  userId: string;
  kind: FollowListKind;
}

export function FollowListPage({ userId, kind }: FollowListPageProps) {
  const { data: profile, isLoading } = useUserProfile(userId);
  const isFollowing = kind === "following";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href={`/users/${userId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回主页
      </Link>

      <h1 className="mb-5 text-xl font-bold text-foreground">
        {isLoading
          ? (isFollowing ? "关注的人" : "粉丝")
          : isFollowing
            ? `${profile?.username ?? ""} 关注的人`
            : `${profile?.username ?? ""} 的粉丝`}
      </h1>

      {!isLoading && !profile ? (
        <EmptyState title="用户不存在" />
      ) : (
        <UserFollowList userId={userId} kind={kind} />
      )}
    </div>
  );
}
