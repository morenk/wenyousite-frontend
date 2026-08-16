/** 我的收藏管理列表：无限滚动 + 取消收藏 */

"use client";

import { Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import { useBookmarks } from "@/api/hooks/use-bookmarks";
import { useRemoveBookmark } from "@/api/hooks/use-bookmark-actions";
import { BookmarkThreadCard } from "@/components/user/bookmark-thread-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import {
  useMoveBookmark,
  type BookmarkFolder,
} from "@/api/hooks/use-bookmark-folders";

export function BookmarkList({
  folderId,
  folders = [],
}: {
  folderId?: string;
  folders?: BookmarkFolder[];
}) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useBookmarks(folderId);

  const removeBookmark = useRemoveBookmark();
  const moveBookmark = useMoveBookmark();

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
        <EmptyState title="收藏加载失败" />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <EmptyState title={folderId ? "这个收藏夹还是空的" : "还没有收藏"} />
    );
  }

  return (
    <div className="w-full space-y-3">
      {bookmarks.map((bookmark) => (
        <BookmarkThreadCard
          key={bookmark.id}
          thread={bookmark}
          folders={folders}
          onMove={(bookmarkId, nextFolderId) =>
            moveBookmark.mutate(
              { bookmarkId, folderId: nextFolderId },
              { onSuccess: () => toast.success("已移动收藏") },
            )
          }
          onUnbookmark={(bookmarkId, threadId) =>
            removeBookmark.mutate(
              { bookmarkId, threadId },
              {
                onError: (error) => {
                  toast.error(getApiErrorMessage(error, "取消收藏失败，请稍后重试"));
                },
              },
            )
          }
          isMoving={moveBookmark.isPending}
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
