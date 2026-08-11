/** 用户资料卡：头像/用户名/Bio/注册时间/关注粉丝数 + 关注拉黑操作按钮 */

"use client";

import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarDays, Fuel, MessageCircle, ShieldAlert, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { FollowButton } from "@/components/user/follow-button";
import { BlockButton } from "@/components/user/block-button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { ActiveUserPublic } from "@/api/hooks/use-user-profile";
import { LevelBadge } from "@/components/shared/level-badge";
import { WenyouTipButton } from "@/components/economy/wenyou-tip-button";
import { formatWenyou } from "@/lib/wenyou";

interface UserProfileCardProps {
  user: ActiveUserPublic;
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  const { user: me } = useAuth();
  const isSelf = !!me && me.id === user.id;

  return (
    <Card className="relative">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar
              name={user.username}
              src={user.avatar}
              className="h-16 w-16 ring-4 ring-white outline outline-1 outline-border"
              textClassName="text-2xl"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-display text-2xl font-bold text-foreground">
                  {user.username}
                </h1>
                <LevelBadge level={user.level} />
                {user.role === "ADMIN" && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    管理员
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-utility text-xs text-muted-foreground">
                <Link
                  href={`/users/${user.id}/following`}
                  className="flex items-center gap-1 hover:text-brand-strong"
                >
                  <Users className="h-3.5 w-3.5" />
                  关注 {user._count.following}
                </Link>
                <Link
                  href={`/users/${user.id}/followers`}
                  className="flex items-center gap-1 hover:text-brand-strong"
                >
                  粉丝 {user._count.followers}
                </Link>
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {format(new Date(user.createdAt), "yyyy-MM-dd", {
                    locale: zhCN,
                  })}
                </span>
                <span className="flex items-center gap-1" title="累计收到的用户投入总额与次数">
                  <Fuel className="h-3.5 w-3.5" />
                  获得 {formatWenyou(user.receivedTipTotal)} 升 · {user.receivedTipCount} 次
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2">
            {isSelf ? (
              <Link href="/me" className={buttonVariants({ variant: "ghost", size: "compact" })}>
                编辑资料
              </Link>
            ) : (
              <>
                {me && (
                  <>
                    <WenyouTipButton
                      target={{ type: "USER", id: user.id }}
                      recipientName={user.username}
                    />
                    <Link
                      href={`/messages/new/${user.id}`}
                      className={buttonVariants({ variant: "ghost", size: "compact" })}
                    >
                      <MessageCircle className="h-4 w-4" />
                      私聊
                    </Link>
                  </>
                )}
                <FollowButton userId={user.id} isFollowing={!!user.isFollowing} />
                <BlockButton userId={user.id} isBlocked={!!user.isBlocked} />
              </>
            )}
          </div>
        </div>

        {user.accountStatus !== "ACTIVE" ? (
          <div
            role="status"
            className={
              user.accountStatus === "BANNED"
                ? "mt-5 flex items-start gap-3 rounded-xl bg-destructive-soft px-4 py-3 text-destructive"
                : "mt-5 flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-warning"
            }
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-sm font-bold">
                {user.accountStatus === "BANNED"
                  ? "该用户已被永久封禁"
                  : "该用户已被暂时封禁"}
              </p>
              <p className="mt-0.5 text-xs opacity-80">
                {user.accountStatus === "BANNED"
                  ? "该账号已无法登录或进行互动。"
                  : "封禁期间，该账号无法登录或进行互动。"}
              </p>
            </div>
          </div>
        ) : null}

        {user.bio && (
          <p className="mt-5 whitespace-pre-wrap border-t border-border pt-4 text-sm leading-7 text-foreground/90">
            {user.bio}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
