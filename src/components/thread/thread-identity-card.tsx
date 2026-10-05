"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogBackdrop, DialogCloseButton,
  DialogPopup, DialogPortal, DialogTitle, DialogViewport,
} from "@/components/ui/dialog";
import { ThreadIdentitySummary, type ThreadIdentityAppearance } from "./thread-identity-summary";
import type { ThreadAccountAppearance } from "@/lib/thread-identity";
import { cn } from "@/lib/utils";

export type IdentityCardAppearance = ThreadIdentityAppearance;

interface ThreadIdentityCardProps {
  account: ThreadAccountAppearance;
  appearance: IdentityCardAppearance;
  currentAppearance?: IdentityCardAppearance;
  isRoleplay?: boolean;
  badges?: ReactNode;
  avatarClassName?: string;
  avatarTextClassName?: string;
  textClassName?: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onOpen?: () => void;
}

/** 卡片只展示身份与账号入口；发言和筛选保留在原有编辑器、列表中。 */
export function ThreadIdentityCard({
  account, appearance, currentAppearance, isRoleplay = true, badges,
  avatarClassName = "size-8", avatarTextClassName = "text-sm", textClassName = "text-sm",
  loading, error, onRetry, onOpen,
}: ThreadIdentityCardProps) {
  const currentChanged = isRoleplay && currentAppearance && (currentAppearance.name !== appearance.name
    || (currentAppearance.avatarDisplay?.url ?? currentAppearance.avatar) !== (appearance.avatarDisplay?.url ?? appearance.avatar));
  const [open, setOpen] = useState(false);
  const show = () => { setOpen(true); onOpen?.(); };
  const accountAppearance = { name: account.username, avatar: account.avatar ?? null, avatarDisplay: account.avatarDisplay };
  const accountLink = <Link href={"/users/" + account.id} aria-label={"查看" + account.username + "的用户主页"}
    onClick={() => setOpen(false)}
    className={cn("flex min-h-11 min-w-0 items-center gap-3 rounded-[var(--radius-control)] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40",
      isRoleplay ? "px-2 py-2" : "pr-7")}>
    <ThreadIdentitySummary appearance={accountAppearance} badges={isRoleplay ? undefined : badges} compact={isRoleplay} />
    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
  </Link>;
  return <>
    <button type="button" onClick={show}
      aria-label={"查看" + appearance.name + "的帖内身份"}
      className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
      <UserAvatar name={appearance.name} src={appearance.avatar} display={appearance.avatarDisplay}
        className={avatarClassName} textClassName={avatarTextClassName} />
    </button>
    <button type="button" onClick={show}
      className={cn("min-w-0 max-w-full truncate text-left font-medium text-foreground hover:text-brand-strong", textClassName)}>
      {appearance.name}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup className="relative max-w-sm p-5" aria-describedby={undefined}>
            <DialogTitle className="sr-only">帖内身份</DialogTitle>
            <DialogCloseButton className="absolute right-3 top-3" />
            {isRoleplay ? <div className="pr-7"><ThreadIdentitySummary appearance={appearance} badges={badges} /></div> : accountLink}
            {currentChanged ? <div className="mt-3 flex min-w-0 items-center gap-3 text-muted-foreground">
              <span className="shrink-0 text-xs">现为</span>
              <ThreadIdentitySummary appearance={currentAppearance} compact />
            </div> : null}
            {isRoleplay ? <div className="mt-4 border-t border-border pt-2">{accountLink}</div> : null}
            {loading ? <p role="status" className="mt-2 text-xs text-muted-foreground">正在更新当前身份…</p> : null}
            {error ? <div role="alert" className="mt-2 flex items-center gap-2 text-xs text-destructive">
              当前身份加载失败
              <Button variant="ghost" size="compact" onClick={onRetry}>重试</Button>
            </div> : null}
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  </>;
}
