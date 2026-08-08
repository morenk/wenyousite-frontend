/** 收藏/取消收藏按钮：详情页头部操作区使用 */

"use client";

import { Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBookmarkActions } from "@/api/hooks/use-bookmark-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <Button
      variant={variant}
      size={iconOnly ? "icon-sm" : "sm"}
      onClick={handleClick}
      disabled={isPending}
      aria-label={iconOnly ? label : undefined}
      title={label}
      className={cn(
        isBookmarked && iconOnly && "bg-accent text-brand-strong hover:text-brand-strong",
        className,
      )}
    >
      {isPending ? (
        <Loader2 className={cn("h-4 w-4 animate-spin", !iconOnly && "mr-1")} />
      ) : (
        <Bookmark className={cn("h-4 w-4", !iconOnly && "mr-1", isBookmarked && "fill-current")} />
      )}
      {!iconOnly && (isBookmarked ? "已收藏" : "收藏")}
    </Button>
  );
}
