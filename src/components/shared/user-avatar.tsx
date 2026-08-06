/** 用户头像：已注销用户统一用灰色图标；其他用户有 URL 用缩略图，无则显示用户名首字符。 */

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
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary",
        textClassName,
        className,
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
