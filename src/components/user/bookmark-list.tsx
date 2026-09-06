/** 我的收藏管理列表：无限滚动 + 取消收藏 */

"use client";

import { Loader2, ChevronDown } from "lucide-react";
import { useBookmarks } from "@/api/hooks/use-bookmarks";
import { BookmarkThreadCard } from "@/components/user/bookmark-thread-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadError } from "@/components/shared/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import type { BookmarkFolder } from "@/api/hooks/use-bookmark-folders";

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

  const sentinelRef = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  const bookmarks = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  if (isLoading) {
    return <div aria-label="正在加载收藏" role="status" className="space-y-4 py-5">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-20 w-full rounded-xl" />)}</div>;
  }

  if (isError) {
    return <LoadError title="收藏加载失败" onRetry={() => void refetch()} className="py-16" />;
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
          showFolder={!folderId}
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
