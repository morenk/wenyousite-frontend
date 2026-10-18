"use client";

import { useUserMomentBookmarks } from "@/api/hooks/use-user-bookmarks";
import { isUserListUnavailable } from "@/lib/list-query-state";
import { EmptyState } from "@/components/shared/empty-state";
import { MomentMasonry } from "@/components/moment/moment-masonry";

export function UserMomentBookmarksSection({ userId }: { userId: string }) {
  const query = useUserMomentBookmarks(userId);
  const moments = query.data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  if (isUserListUnavailable(query.error)) return <EmptyState title="用户不存在或未公开收藏" />;

  return (
    <MomentMasonry
      moments={moments}
      maxLanes={3}
      isLoading={query.isLoading}
      error={query.error}
      hasNextPage={!!query.hasNextPage}
      isFetchingNextPage={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      onRetry={() => void query.refetch()}
      emptyTitle="还没有收藏动态"
    />
  );
}
