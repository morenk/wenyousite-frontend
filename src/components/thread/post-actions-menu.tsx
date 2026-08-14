/** 帖子卡片统一操作菜单：回复、复制、编辑与删除。 */

"use client";

import { Menu } from "@base-ui/react/menu";
import Link from "next/link";
import { Copy, Ellipsis, Link2, MessageSquare, Pencil, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdminContentModerationDialog,
  type AdminModerationTarget,
} from "@/components/admin/admin-content-moderation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface PostActionsMenuProps {
  triggerLabel: string;
  menuLabel: string;
  copyText: () => string;
  copyHref: string;
  replyHref?: string;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  moderationTarget?: AdminModerationTarget;
  onModerated?: () => void;
}

const menuItemClassName =
  "flex min-h-9 w-full cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground focus:bg-accent focus:text-accent-foreground";

async function copyToClipboard(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("复制失败，请稍后重试");
  }
}

export function getVisibleContentText(elementId: string, fallback: string) {
  const contentElement = document.getElementById(elementId);
  return (contentElement?.innerText ?? "").trim()
    || contentElement?.textContent?.trim()
    || fallback;
}

export function PostActionsMenu({
  triggerLabel,
  menuLabel,
  copyText,
  copyHref,
  replyHref,
  onReply,
  onEdit,
  onDelete,
  moderationTarget,
  onModerated,
}: PostActionsMenuProps) {
  const { user } = useAuth();
  const [moderationOpen, setModerationOpen] = useState(false);
  const canModerate = Boolean(
    moderationTarget && (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN"),
  );

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={triggerLabel}
              title={triggerLabel}
            />
          }
        >
          <Ellipsis className="size-4" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[var(--layer-popup)]">
            <Menu.Popup
              aria-label={menuLabel}
              className="w-44 origin-(--transform-origin) rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-popover outline-none duration-[var(--motion-standard)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            >
            {replyHref ? (
              <Menu.LinkItem
                render={<Link href={replyHref} />}
                closeOnClick
                className={menuItemClassName}
              >
                <MessageSquare className="size-4" aria-hidden="true" />
                回复
              </Menu.LinkItem>
            ) : onReply ? (
              <Menu.Item className={menuItemClassName} onClick={onReply}>
                <MessageSquare className="size-4" aria-hidden="true" />
                回复
              </Menu.Item>
            ) : null}
            <Menu.Item
              className={menuItemClassName}
              onClick={() => void copyToClipboard(copyText(), "文本已复制")}
            >
              <Copy className="size-4" aria-hidden="true" />
              复制文本
            </Menu.Item>
            <Menu.Item
              className={menuItemClassName}
              onClick={() => void copyToClipboard(
                `${window.location.origin}${copyHref}`,
                "链接已复制",
              )}
            >
              <Link2 className="size-4" aria-hidden="true" />
              复制链接
            </Menu.Item>
            {onEdit ? (
              <Menu.Item className={menuItemClassName} onClick={onEdit}>
                <Pencil className="size-4" aria-hidden="true" />
                编辑
              </Menu.Item>
            ) : null}
            {canModerate ? (
              <>
                <Menu.Separator className="mx-2 my-1 h-px bg-border" />
                <Menu.Item
                  className={cn(
                    menuItemClassName,
                    "text-destructive data-highlighted:bg-destructive-soft data-highlighted:text-destructive focus:bg-destructive-soft focus:text-destructive",
                  )}
                  onClick={() => setModerationOpen(true)}
                >
                  <ShieldAlert className="size-4" aria-hidden="true" />
                  站务隐藏
                </Menu.Item>
              </>
            ) : null}
            {onDelete ? (
              <>
                {!canModerate ? <Menu.Separator className="mx-2 my-1 h-px bg-border" /> : null}
                <Menu.Item
                  className={cn(
                    menuItemClassName,
                    "text-destructive data-highlighted:bg-destructive-soft data-highlighted:text-destructive focus:bg-destructive-soft focus:text-destructive",
                  )}
                  onClick={onDelete}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  删除
                </Menu.Item>
              </>
            ) : null}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {canModerate && moderationTarget ? (
        <AdminContentModerationDialog
          target={moderationTarget}
          open={moderationOpen}
          onOpenChange={setModerationOpen}
          onHidden={onModerated}
        />
      ) : null}
    </>
  );
}
