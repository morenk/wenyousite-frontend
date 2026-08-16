/** 用户创建的帖子列表（薄包装：useUserCreatedThreads + 首页 ThreadList） */

"use client";

import { useUserCreatedThreads } from "@/api/hooks/use-user-created-threads";
import { ThreadList } from "@/components/thread/thread-list";

interface UserCreatedThreadsProps {
  userId: string;
}

export function UserCreatedThreads({ userId }: UserCreatedThreadsProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useUserCreatedThreads(userId);

  const threads = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  return (
    <ThreadList
      threads={threads}
      isLoading={isLoading}
      error={isError ? error ?? new Error("该用户未公开创建的帖子") : null}
      hasNextPage={!!hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={() => void fetchNextPage()}
      onRetry={() => void refetch()}
      emptyTitle="还没有创建过帖子"
      errorTitle="该用户未公开创建的帖子"
    />
  );
}
