"use client";

import { useUserMoments } from "@/api/hooks/use-moments";
import { MomentMasonry } from "@/components/moment/moment-masonry";
import { useAuth } from "@/lib/auth";

export function UserMomentsSection({ userId }: { userId: string }) {
  const { user } = useAuth();
  const query = useUserMoments(userId, user?.id);
  const moments = query.data?.pages.flatMap((page) => page.data) ?? [];
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
      emptyTitle="还没有发布动态"
      emptyDescription="发布的动态会显示在这里。"
    />
  );
}
