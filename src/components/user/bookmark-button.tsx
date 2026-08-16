/** 收藏/取消收藏按钮：详情页头部操作区使用 */

"use client";

import { toast } from "sonner";
import { useBookmarkActions } from "@/api/hooks/use-bookmark-actions";
import { InteractionToggle } from "@/components/ui/interaction-toggle";

interface BookmarkButtonProps {
  threadId: string;
  isBookmarked: boolean;
  bookmarkId: string | null;
  iconOnly?: boolean;
  variant?: "outline" | "ghost";
  className?: string;
}

export function BookmarkButton({
  threadId,
  isBookmarked,
  bookmarkId,
  iconOnly = false,
  variant = "ghost",
  className,
}: BookmarkButtonProps) {
  const { add, remove } = useBookmarkActions(threadId);
  const isPending = add.isPending || remove.isPending;

  const handleClick = async () => {
    try {
      if (isBookmarked) {
        if (!bookmarkId) return;
        await remove.mutateAsync(bookmarkId);
        toast.success("已取消收藏");
      } else {
        await add.mutateAsync();
        toast.success("已收藏");
      }
    } catch {
      toast.error("操作失败，请稍后重试");
    }
  };

  const label = isBookmarked ? "取消收藏" : "收藏帖子";

  return (
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
  );
}
