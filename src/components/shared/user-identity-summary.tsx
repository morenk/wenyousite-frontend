"use client";

import type { ReactNode } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { MediaDisplay } from "@/lib/media-display";
import { cn } from "@/lib/utils";

export interface UserIdentityAppearance {
  name: string;
  avatar: string | null;
  avatarDisplay?: MediaDisplay | null;
}

/** 头像与名称的共享展示；不持有选择、权限或账号动作。 */
export function UserIdentitySummary({
  appearance, label, accountUsername, compact = false, truncate = false, avatarSlot, badges,
}: {
  appearance: UserIdentityAppearance;
  label?: string;
  accountUsername?: string;
  compact?: boolean;
  truncate?: boolean;
  avatarSlot?: ReactNode;
  badges?: ReactNode;
}) {
  return <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
    {avatarSlot ?? <UserAvatar name={appearance.name} src={appearance.avatar} display={appearance.avatarDisplay}
      className={compact ? "size-8" : "size-12"} textClassName={compact ? "text-sm" : "text-lg"} />}
    <span className="min-w-0 flex-1">
      <span className={cn("block min-w-0", badges && (truncate ? "flex items-center gap-2" : "flex flex-wrap items-center gap-x-2 gap-y-1"))}>
        <span className={cn("block font-semibold text-foreground", compact ? "text-sm" : "text-base",
          truncate ? "min-w-0 truncate" : "whitespace-normal break-words [overflow-wrap:anywhere]")}
          title={truncate ? appearance.name : undefined}>{appearance.name}</span>
        {badges}
      </span>
      {label || accountUsername ? <span className={cn("block text-xs font-normal text-muted-foreground",
        truncate ? "truncate" : "whitespace-normal break-words [overflow-wrap:anywhere]")}>
        {label}{accountUsername ? (label ? " · @" : "@") + accountUsername : ""}
      </span> : null}
    </span>
  </span>;
}
