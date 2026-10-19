/** 用户创建的帖子列表（薄包装：useUserCreatedThreads + 首页 ThreadList） */

"use client";

import { useUserCreatedThreads } from "@/api/hooks/use-user-created-threads";
import { isUserListUnavailable } from "@/lib/list-query-state";
import { EmptyState } from "@/components/shared/empty-state";
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
    error,
    refetch,
  } = useUserCreatedThreads(userId);

  const threads = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  if (isUserListUnavailable(error)) return <EmptyState title="用户不存在" />;

  return (
    <ThreadList
      threads={threads}
      isLoading={isLoading}
      error={error}
      hasNextPage={!!hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={() => void fetchNextPage()}
      onRetry={() => void refetch()}
      emptyTitle="还没有创建过帖子"
      errorTitle="创建的帖子加载失败"
    />
  );
}
