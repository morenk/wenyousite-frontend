/** 用户资料页「收藏」区块：read-only，尊重 showBookmarks 隐私（404=未公开） */

"use client";

import { useUserBookmarks } from "@/api/hooks/use-user-bookmarks";
import { isUserListUnavailable } from "@/lib/list-query-state";
import { EmptyState } from "@/components/shared/empty-state";
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
    error,
    refetch,
  } = useUserBookmarks(userId);

  const bookmarks = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  if (isUserListUnavailable(error)) return <EmptyState title="用户不存在或未公开收藏" />;

  return (
    <ThreadList
      threads={bookmarks}
      isLoading={isLoading}
      error={error}
      hasNextPage={!!hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={() => void fetchNextPage()}
      onRetry={() => void refetch()}
      emptyTitle="还没有收藏"
      errorTitle="收藏加载失败"
    />
  );
}
