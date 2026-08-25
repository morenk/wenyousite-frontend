/** 用户头像：缺失或加载失败显示首字符；匿名、注销或不可用身份显示中性图标。 */

"use client";

import { IDENTITY_PRESENTATION } from "@wenyousite/foundation/elements";
import { UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

const DEACTIVATED_USER_NAME = "已注销用户";
const ANONYMOUS_USER_NAME = "匿名用户";

interface UserAvatarProps {
  name: string;
  src: string | null;
  /** 圆形容器尺寸，如 "h-9 w-9" */
  className?: string;
  /** 首字符占位的字号，如 "text-sm"（默认 text-sm） */
  textClassName?: string;
}

interface UserAvatarLinkProps extends UserAvatarProps {
  userId: string;
  linkClassName?: string;
}

function UnavailableAvatar({ name, className }: Pick<UserAvatarProps, "name" | "className">) {
  return (
    <div
      role="img"
      aria-label={`${name || "不可用用户"}头像`}
      data-testid="deactivated-user-avatar"
      data-avatar-fallback={IDENTITY_PRESENTATION.avatarFallback.unavailableOrAnonymous}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
        className,
      )}
    >
      <UserRound aria-hidden="true" className="h-1/2 w-1/2" />
    </div>
  );
}

function InitialAvatar({ name, className, textClassName }: UserAvatarProps) {
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase("zh-CN");
  if (!initial) return <UnavailableAvatar name={name} className={className} />;
  return (
    <div
      role="img"
      aria-label={`${name}头像`}
      data-testid="user-avatar-placeholder"
      data-avatar-fallback={IDENTITY_PRESENTATION.avatarFallback.missingOrFailed}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent font-bold text-brand-strong",
        textClassName,
        className,
      )}
    >
      {initial}
    </div>
  );
}

function AvatarImage({ name, src, className, textClassName }: UserAvatarProps & { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <InitialAvatar name={name} src={null} className={className} textClassName={textClassName} />;
  }
  // AVATAR 只生成 512×512 WebP 母版；接口 URL 可直接展示，不能拼接通用派生图后缀。
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={cn("shrink-0 overflow-hidden rounded-full object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}

export function UserAvatar({ name, src, className, textClassName = "text-sm" }: UserAvatarProps) {
  if (!name.trim() || name === DEACTIVATED_USER_NAME || name === ANONYMOUS_USER_NAME) {
    return (
      <UnavailableAvatar name={name} className={className} />
    );
  }

  if (src) {
    return <AvatarImage key={src} name={name} src={src} className={className} textClassName={textClassName} />;
  }
  return <InitialAvatar name={name} src={null} className={className} textClassName={textClassName} />;
}

export function UserAvatarLink({
  userId,
  name,
  src,
  className,
  textClassName,
  linkClassName,
}: UserAvatarLinkProps) {
  return (
    <Link
      href={`/users/${userId}`}
      aria-label={`查看${name}的用户主页`}
      className={cn(
        "inline-flex shrink-0 rounded-full outline-none transition-shadow hover:ring-2 hover:ring-brand-strong/25 focus-visible:ring-2 focus-visible:ring-ring/40",
        linkClassName,
      )}
    >
      <UserAvatar
        name={name}
        src={src}
        className={className}
        textClassName={textClassName}
      />
    </Link>
  );
}
