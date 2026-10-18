"use client";

import { useState } from "react";
import { Menu } from "@/components/ui/menu";
import { toast } from "sonner";
import type { BookmarkFolderKind } from "@/api/hooks/use-bookmark-folders";
import { getApiErrorMessage } from "@/api/errors";
import { BookmarkFolderPickerDialog } from "@/components/user/bookmark-folder-picker-dialog";
import { Button } from "@/components/ui/button";
import { WenyouIcon } from "@/components/ui/wenyou-icon";

export function BookmarkActionsMenu({ title, folderId, kind = "threads", pending, canMove = true, onMove, onRemove, onRestore }: {
  title: string;
  folderId?: string;
  kind?: BookmarkFolderKind;
  pending: boolean;
  canMove?: boolean;
  onMove: (folderId: string) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
  onRestore: () => Promise<unknown>;
}) {
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string>();

  async function remove() {
    setError(undefined);
    try {
      await onRemove();
      // 撤销需要在条目卸载后仍可执行，使用带动作的反馈保留恢复入口。
      let restoring = false;
      const notification = toast(`已取消收藏“${title}”`, {
        duration: 10000,
        action: {
          label: "撤销",
          onClick: (event) => {
            event.preventDefault();
            if (restoring) return;
            restoring = true;
            void onRestore().then(() => toast.dismiss(notification)).catch((error) => {
              toast.error(getApiErrorMessage(error, "恢复收藏失败，请重试"));
            }).finally(() => { restoring = false; });
          },
        },
      });
    } catch (error) {
      const message = getApiErrorMessage(error, "取消收藏失败，请重试");
      setError(message);
      toast.error(message);
    }
  }

  return (
    <div className="shrink-0">
      <Menu.Root>

          <Menu.Trigger tooltip="更多收藏操作" render={<Button type="button" variant="ghost" size="icon" aria-label={`更多收藏操作：${title}`} disabled={pending} />}>
            <WenyouIcon id={pending ? "status.loading" : "action.more"} className={pending ? "animate-spin" : undefined} />
          </Menu.Trigger>

        <Menu.Content align="end" sideOffset={4} className="w-48">
              <Menu.Item disabled={!canMove || !folderId || pending} onClick={() => setMoving(true)}>移动到收藏夹</Menu.Item>
              <Menu.Item disabled={pending} onClick={() => void remove()}>取消收藏</Menu.Item>
            </Menu.Content>
      </Menu.Root>
      {error ? <p role="alert" className="max-w-48 text-sm text-destructive">{error}</p> : null}
      {moving ? <BookmarkFolderPickerDialog open onOpenChange={setMoving} contentLabel={title} kind={kind} intent="move" initialFolderId={folderId} isPending={pending} onConfirm={async (id) => { await onMove(id); }} /> : null}
    </div>
  );
}
