/** 收藏/取消收藏按钮：详情页头部操作区使用 */

"use client";

import { Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBookmarkActions } from "@/api/hooks/use-bookmark-actions";
import { Button } from "@/components/ui/button";

interface BookmarkButtonProps {
  threadId: string;
  isBookmarked: boolean;
  bookmarkId: string | null;
}

export function BookmarkButton({
  threadId,
  isBookmarked,
  bookmarkId,
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

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      title={isBookmarked ? "取消收藏" : "收藏帖子"}
    >
      {isPending ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <Bookmark className={isBookmarked ? "mr-1 h-4 w-4 fill-current" : "mr-1 h-4 w-4"} />
      )}
      {isBookmarked ? "已收藏" : "收藏"}
    </Button>
  );
}
