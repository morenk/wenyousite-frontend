/** 用户头像：已注销用户统一用灰色图标；其他用户有 URL 用缩略图，无则显示用户名首字符。 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getImageUrlBySize } from "@/lib/upload-image";
import { UserRound } from "lucide-react";

const DEACTIVATED_USER_NAME = "已注销用户";

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

export function UserAvatar({ name, src, className, textClassName = "text-sm" }: UserAvatarProps) {
  if (name === DEACTIVATED_USER_NAME) {
    return (
      <div
        role="img"
        aria-label="已注销用户头像"
        data-testid="deactivated-user-avatar"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
          className,
        )}
      >
        <UserRound aria-hidden="true" className="h-1/2 w-1/2" />
      </div>
    );
  }

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={getImageUrlBySize(src, "thumb")}
        alt={name}
        className={cn("shrink-0 overflow-hidden rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      data-testid="user-avatar-placeholder"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent font-display font-bold text-brand-strong",
        textClassName,
        className,
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
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
        "inline-flex shrink-0 rounded-full outline-none transition-shadow hover:ring-2 hover:ring-primary/25 focus-visible:ring-2 focus-visible:ring-ring/40",
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
