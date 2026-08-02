/** 用户资料卡：头像/用户名/Bio/注册时间/关注粉丝数 + 关注拉黑操作按钮 */

"use client";

import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarDays, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { FollowButton } from "@/components/user/follow-button";
import { BlockButton } from "@/components/user/block-button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UserPublic } from "@/api/hooks/use-user-profile";

interface UserProfileCardProps {
  user: UserPublic;
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  const { user: me } = useAuth();
  const isSelf = !!me && me.id === user.id;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={user.username} src={user.avatar} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">
                  {user.username}
                </h1>
                {user.role === "ADMIN" && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    管理员
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                <Link
                  href={`/users/${user.id}/following`}
                  className="flex items-center gap-1 hover:text-primary"
                >
                  <Users className="h-3.5 w-3.5" />
                  关注 {user._count.following}
                </Link>
                <Link
                  href={`/users/${user.id}/followers`}
                  className="flex items-center gap-1 hover:text-primary"
                >
                  粉丝 {user._count.followers}
                </Link>
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {format(new Date(user.createdAt), "yyyy-MM-dd", {
                    locale: zhCN,
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSelf ? (
              <Link href="/me">
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-8 items-center rounded-md border border-border px-3 text-sm",
                    "text-muted-foreground hover:bg-muted",
                  )}
                >
                  编辑资料
                </button>
              </Link>
            ) : (
              <>
                <FollowButton userId={user.id} isFollowing={!!user.isFollowing} />
                <BlockButton userId={user.id} isBlocked={!!user.isBlocked} />
              </>
            )}
          </div>
        </div>

        {user.bio && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-foreground/90">
            {user.bio}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** 头像：有 URL 用图片，无则显示用户名首字符 */
function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className="h-16 w-16 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
