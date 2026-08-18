/** 收藏/取消收藏按钮：详情页头部操作区使用 */

"use client";

import { toast } from "sonner";
import { useBookmarkActions } from "@/api/hooks/use-bookmark-actions";
import { BookmarkFolderPickerDialog } from "@/components/user/bookmark-folder-picker-dialog";
import { InteractionToggle } from "@/components/ui/interaction-toggle";
import { useState } from "react";

interface BookmarkButtonProps {
  threadId: string;
  isBookmarked: boolean;
  bookmarkId: string | null;
  contentLabel?: string;
  iconOnly?: boolean;
  variant?: "outline" | "ghost";
  className?: string;
}

export function BookmarkButton({
  threadId,
  isBookmarked,
  bookmarkId,
  contentLabel = "这个主题帖",
  iconOnly = false,
  variant = "ghost",
  className,
}: BookmarkButtonProps) {
  const { add, remove } = useBookmarkActions(threadId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isPending = add.isPending || remove.isPending;

  const handleClick = async () => {
    try {
      if (isBookmarked) {
        if (!bookmarkId) return;
        await remove.mutateAsync(bookmarkId);
      } else {
        setPickerOpen(true);
      }
    } catch {
      toast.error("操作失败，请稍后重试");
    }
  };

  const label = isBookmarked ? "取消收藏" : "收藏帖子";

  return (
    <>
      <InteractionToggle
        tone="bookmark"
        pressed={isBookmarked}
        pending={isPending}
        icon="action.bookmark"
        accessibleName="收藏"
        actionTitle={label}
        variant={variant}
        size={iconOnly ? "icon-sm" : "sm"}
        onClick={handleClick}
        className={className}
      >
        {!iconOnly && (isBookmarked ? "已收藏" : "收藏")}
      </InteractionToggle>
      <BookmarkFolderPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        contentLabel={contentLabel}
        isPending={add.isPending}
        onConfirm={async (folderId) => {
          try {
            await add.mutateAsync(folderId);
          } catch (error) {
            toast.error("操作失败，请稍后重试");
            throw error;
          }
        }}
      />
    </>
  );
}
