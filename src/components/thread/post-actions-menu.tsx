/** 帖子卡片低频操作菜单：复制、编辑、删除与站务处理。 */

"use client";

import { Menu } from "@base-ui/react/menu";
import { Copy, Ellipsis, Link2, Pencil, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdminContentModerationDialog,
  type AdminModerationTarget,
} from "@/components/admin/admin-content-moderation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  createReaderClipboardPayload,
  writeSiteClipboardPayload,
} from "@/lib/site-clipboard";
import { cn } from "@/lib/utils";
import { WenyouIcon } from "@/components/ui/wenyou-icon";

interface PostActionsMenuProps {
  triggerLabel: string;
  menuLabel: string;
  copyText: () => string;
  copyContentId?: string;
  copyHref: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  pinned?: boolean;
  pinPending?: boolean;
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

async function copyContentToClipboard(elementId: string | undefined, fallback: string) {
  const container = elementId ? document.getElementById(elementId) : null;
  const content = container?.matches('[data-slot="markdown-content"]')
    ? container
    : container?.querySelector<HTMLElement>('[data-slot="markdown-content"]');
  try {
    if (content) {
      await writeSiteClipboardPayload(createReaderClipboardPayload(content));
    } else {
      await navigator.clipboard.writeText(fallback);
    }
    toast.success("内容已复制");
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
  copyContentId,
  copyHref,
  onEdit,
  onDelete,
  onPin,
  pinned = false,
  pinPending = false,
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
              className="w-52 origin-(--transform-origin) rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-popover outline-none duration-[var(--motion-standard)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            >
            <Menu.Item
              className={menuItemClassName}
              onClick={() => void copyContentToClipboard(copyContentId, copyText())}
            >
              <Copy className="size-4" aria-hidden="true" />
              复制内容
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
            {onPin ? (
              <Menu.Item
                className={menuItemClassName}
                disabled={pinPending}
                onClick={onPin}
              >
                <WenyouIcon id="action.pin" className="size-4" />
                {pinned ? "取消置顶" : "置顶到当前子贴"}
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
