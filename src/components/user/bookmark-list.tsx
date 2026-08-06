/** 我的收藏管理列表：无限滚动 + 取消收藏 */

"use client";

import { Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useBookmarks } from "@/api/hooks/use-bookmarks";
import { useRemoveBookmark } from "@/api/hooks/use-bookmark-actions";
import { BookmarkThreadCard } from "@/components/user/bookmark-thread-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

export function BookmarkList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useBookmarks();

  const removeBookmark = useRemoveBookmark();

  const sentinelRef = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  const bookmarks = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <EmptyState title="收藏加载失败" description="请稍后重试" />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <EmptyState title="还没有收藏" description="在帖子详情页点击收藏即可添加" />
    );
  }

  return (
    <div className="space-y-3">
      {bookmarks.map((bookmark) => (
        <BookmarkThreadCard
          key={bookmark.id}
          thread={bookmark}
          onUnbookmark={(bookmarkId, threadId) =>
            removeBookmark.mutate(
              { bookmarkId, threadId },
              { onSuccess: () => toast.success("已取消收藏") },
            )
          }
          isUnbookmarking={removeBookmark.isPending}
        />
      ))}

      <div ref={sentinelRef} className="flex items-center justify-center py-2">
        {isFetchingNextPage && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {hasNextPage && !isFetchingNextPage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            className="text-xs"
          >
            <ChevronDown className="mr-1 h-3.5 w-3.5" />
            加载更多
          </Button>
        )}
        {!hasNextPage && (
          <span className="text-xs text-muted-foreground">没有更多了</span>
        )}
      </div>
    </div>
  );
}
