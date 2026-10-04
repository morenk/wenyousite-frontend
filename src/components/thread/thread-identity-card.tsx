"use client";

import { useState } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogBackdrop, DialogCloseButton, DialogDescription,
  DialogPopup, DialogPortal, DialogTitle, DialogViewport,
} from "@/components/ui/dialog";
import type { MediaDisplay } from "@/lib/media-display";
import { cn } from "@/lib/utils";

export interface IdentityCardAppearance {
  name: string;
  avatar: string | null;
  avatarDisplay?: MediaDisplay | null;
}

interface ThreadIdentityCardProps {
  account: { id: string; username: string };
  appearance: IdentityCardAppearance;
  currentName?: string;
  historical?: boolean;
  avatarClassName?: string;
  avatarTextClassName?: string;
  textClassName?: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onOpen?: () => void;
  onMention?: () => void | Promise<void>;
  onFilter?: () => void | Promise<void>;
}

/** 角色只是帖内展示；账号链接及所有动作继续由稳定账号承担。 */
export function ThreadIdentityCard({
  account, appearance, currentName, historical = false,
  avatarClassName = "size-8", avatarTextClassName = "text-sm", textClassName = "text-sm",
  loading, error, onRetry, onOpen, onMention, onFilter,
}: ThreadIdentityCardProps) {
  const [open, setOpen] = useState(false);
  const show = () => { setOpen(true); onOpen?.(); };
  const run = async (action: () => void | Promise<void>) => {
    setOpen(false);
    await action();
  };
  return (
    <>
      <button type="button" onClick={show}
        aria-label={`查看${appearance.name}的帖内身份`}
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
            <DialogPopup className="max-w-sm p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <DialogTitle>帖内身份</DialogTitle>
                <DialogCloseButton />
              </div>
              <div className="flex items-center gap-3">
                <UserAvatar name={appearance.name} src={appearance.avatar} display={appearance.avatarDisplay} className="size-14" textClassName="text-xl" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{historical ? "本条发言身份" : "当前帖内身份"}</p>
                  <p className="break-words font-semibold text-foreground">{appearance.name}</p>
                </div>
              </div>
              {currentName && currentName !== appearance.name ? (
                <p className="mt-3 break-words text-sm text-muted-foreground">当前帖内昵称：{currentName}</p>
              ) : null}
              <DialogDescription className="mt-3 break-words">站内账号：{account.username}</DialogDescription>
              {loading ? <p role="status" className="mt-2 text-xs text-muted-foreground">正在更新当前身份…</p> : null}
              {error ? <div role="alert" className="mt-2 flex items-center gap-2 text-xs text-destructive">
                当前身份加载失败
                <Button variant="ghost" size="compact" onClick={onRetry}>重试</Button>
              </div> : null}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {onMention ? <Button variant="secondary" size="sm" onClick={() => void run(onMention)}>提及</Button> : null}
                {onFilter ? <Button variant="secondary" size="sm" onClick={() => void run(onFilter)}>只看此人</Button> : null}
                <Link href={`/users/${account.id}`} className="ml-auto text-sm text-brand-strong hover:underline">查看站内主页</Link>
              </div>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>
    </>
  );
}
