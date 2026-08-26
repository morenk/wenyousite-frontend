"use client";

import { useUserMomentBookmarks } from "@/api/hooks/use-user-bookmarks";
import { MomentMasonry } from "@/components/moment/moment-masonry";

export function UserMomentBookmarksSection({ userId }: { userId: string }) {
  const query = useUserMomentBookmarks(userId);
  const moments = query.data?.pages.flatMap((page) => page?.data ?? []) ?? [];

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
      emptyDescription="收藏的动态会显示在这里。"
    />
  );
}
