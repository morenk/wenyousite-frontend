/** 用户资料页「收藏」区块：read-only，尊重 showBookmarks 隐私（404=未公开） */

"use client";

import { useUserBookmarks } from "@/api/hooks/use-user-bookmarks";
import { ThreadList } from "@/components/thread/thread-list";

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
    error,
    refetch,
  } = useUserBookmarks(userId);

  const bookmarks = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  return (
    <ThreadList
      threads={bookmarks}
      isLoading={isLoading}
      error={isError ? error ?? new Error("该用户未公开收藏") : null}
      hasNextPage={!!hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={() => void fetchNextPage()}
      onRetry={() => void refetch()}
      emptyTitle="还没有收藏"
      errorTitle="该用户未公开收藏"
    />
  );
}
