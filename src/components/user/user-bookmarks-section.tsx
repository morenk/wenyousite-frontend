/** 用户资料页「收藏」区块：read-only，尊重 showBookmarks 隐私（404=未公开） */

"use client";

import { Loader2, ChevronDown } from "lucide-react";
import { useUserBookmarks } from "@/api/hooks/use-user-bookmarks";
import { BookmarkThreadCard } from "@/components/user/bookmark-thread-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

interface UserBookmarksSectionProps {
  userId: string;
}

export function UserBookmarksSection({ userId }: UserBookmarksSectionProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useUserBookmarks(userId);

  const sentinelRef = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  const bookmarks = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>;
  }

  if (isError) {
    return <EmptyState title="该用户未公开收藏" />;
  }

  if (bookmarks.length === 0) {
    return <EmptyState title="还没有收藏" />;
  }

  return (
    <div className="w-full space-y-3">
      {bookmarks.map((bookmark) => (
        <BookmarkThreadCard key={bookmark.id} thread={bookmark} />
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
      </div>
    </div>
  );
}
