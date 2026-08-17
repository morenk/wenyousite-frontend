/** 用户资料卡：无背景时保持紧凑默认布局，有背景时启用半覆盖头像布局。 */

"use client";

import Link from "next/link";
import { IDENTITY_PRESENTATION } from "@wenyousite/foundation/elements";
import { CalendarDays, Fuel, MessageCircle, ShieldAlert, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { FollowButton } from "@/components/user/follow-button";
import { BlockButton } from "@/components/user/block-button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { WenyouCount } from "@/components/shared/wenyou-count";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ActiveUserPublic } from "@/api/hooks/use-user-profile";
import { LevelBadge } from "@/components/shared/level-badge";
import { WenyouTipButton } from "@/components/economy/wenyou-tip-button";
import { formatWenyou } from "@/lib/wenyou";
import { ProfileCover } from "@/components/user/profile-cover";

interface UserProfileCardProps {
  user: ActiveUserPublic;
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  const { user: me } = useAuth();
  const isSelf = !!me && me.id === user.id;

  if (!user.profileCover) {
    return (
      <Card className="relative gap-0 py-0">
        <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />
        <div className="p-3 pt-5 sm:p-5 sm:pt-6">
          <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-start sm:gap-x-4">
            <UserAvatar
              name={user.username}
              src={user.avatar}
              className="col-start-1 row-start-1 size-14 ring-4 ring-card outline outline-1 outline-border sm:row-span-2 sm:size-16"
              textClassName="text-xl sm:text-2xl"
            />
            <div className="col-start-2 row-start-1 min-w-0">
              <ProfileName user={user} />
            </div>
            <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2">
              <ProfileMetadata user={user} />
            </div>
            <div className="col-span-2 row-start-3 mt-3 sm:col-span-1 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:mt-0">
              <ProfileActions user={user} me={me} isSelf={isSelf} />
            </div>
          </div>
          <AccountStatus user={user} />
          <ProfileBio user={user} />
        </div>
      </Card>
    );
  }

  return (
    <Card className="isolate gap-0 py-0">
      <ProfileCover cover={user.profileCover} username={user.username} className="relative z-0" />
      <div className="relative z-10 grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3 px-3 pb-4 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-4 sm:px-5 sm:pb-5">
        <UserAvatar
          name={user.username}
          src={user.avatar}
          className="relative z-20 -mt-8 size-16 ring-4 ring-card outline outline-1 outline-border sm:-mt-12 sm:size-24"
          textClassName="text-xl sm:text-3xl"
        />

        <div className="contents sm:block sm:min-w-0 sm:pt-4">
          <div className="contents sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
            <div className="col-start-2 row-start-1 min-w-0 pt-2 sm:pt-0">
              <ProfileName user={user} />
            </div>
            <div className="col-span-2 row-start-3 mt-3 sm:col-auto sm:row-auto sm:mt-0">
              <ProfileActions user={user} me={me} isSelf={isSelf} />
            </div>
          </div>
          <div className="col-span-2 row-start-2 sm:col-auto sm:row-auto">
            <ProfileMetadata user={user} />
          </div>
        </div>

        <div className="col-span-2">
          <AccountStatus user={user} />
          <ProfileBio user={user} />
        </div>
      </div>
    </Card>
  );
}

function ProfileName({ user }: { user: ActiveUserPublic }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
        {user.username}
      </h1>
      <LevelBadge level={user.level} />
      {user.role === "ADMIN" ? (
        <Badge tone={IDENTITY_PRESENTATION.roleTones.staff} size="compact">管理员</Badge>
      ) : null}
    </div>
  );
}

function ProfileMetadata({ user }: { user: ActiveUserPublic }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-utility text-xs text-muted-foreground">
      <Link
        href={`/users/${user.id}/following`}
        className="flex items-center gap-1 hover:text-brand-strong"
      >
        <Users className="size-3.5" />
        关注 <WenyouCount value={user._count.following} label="关注" announceLabel={false} />
      </Link>
      <Link
        href={`/users/${user.id}/followers`}
        className="flex items-center gap-1 hover:text-brand-strong"
      >
        粉丝 <WenyouCount value={user._count.followers} label="粉丝" announceLabel={false} />
      </Link>
      <span className="flex items-center gap-1">
        <CalendarDays className="size-3.5" />
        <WenyouTime value={user.createdAt} />
      </span>
      <span className="flex items-center gap-1" title="累计收到的用户投入总额与次数">
        <Fuel className="size-3.5" />
        获得 {formatWenyou(user.receivedTipTotal)} 升 · <WenyouCount value={user.receivedTipCount} label="投入次数" announceLabel={false} /> 次
      </span>
    </div>
  );
}

function ProfileActions({
  user,
  me,
  isSelf,
}: {
  user: ActiveUserPublic;
  me: ReturnType<typeof useAuth>["user"];
  isSelf: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {isSelf ? (
        <Link
          href="/me#profile-appearance"
          className={buttonVariants({ variant: "outline", size: "compact" })}
        >
          编辑主页
        </Link>
      ) : (
        <>
          {me ? (
            <>
              <WenyouTipButton
                target={{ type: "USER", id: user.id }}
                recipientName={user.username}
              />
              <Link
                href={`/messages/new/${user.id}`}
                className={buttonVariants({ variant: "ghost", size: "compact" })}
              >
                <MessageCircle className="size-4" />
                私聊
              </Link>
            </>
          ) : null}
          <FollowButton userId={user.id} isFollowing={!!user.isFollowing} />
          <BlockButton userId={user.id} isBlocked={!!user.isBlocked} />
        </>
      )}
    </div>
  );
}

function AccountStatus({ user }: { user: ActiveUserPublic }) {
  if (user.accountStatus === "ACTIVE") return null;
  return (
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
          {user.accountStatus === "BANNED" ? "该用户已被永久封禁" : "该用户已被暂时封禁"}
        </p>
        <p className="mt-0.5 text-xs opacity-80">
          {user.accountStatus === "BANNED"
            ? "该账号已无法登录或进行互动。"
            : "封禁期间，该账号无法登录或进行互动。"}
        </p>
      </div>
    </div>
  );
}

function ProfileBio({ user }: { user: ActiveUserPublic }) {
  return user.bio ? (
    <p className="mt-5 whitespace-pre-wrap border-t border-border pt-4 text-sm leading-7 text-foreground/90">
      {user.bio}
    </p>
  ) : null;
}
