/** 用户创建的帖子列表（薄包装：useUserCreatedThreads + UserThreadList） */

"use client";

import { useUserCreatedThreads } from "@/api/hooks/use-user-created-threads";
import { UserThreadList } from "@/components/user/user-thread-list";

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
  } = useUserCreatedThreads(userId);

  const threads = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  return (
    <UserThreadList
      threads={threads}
      isLoading={isLoading}
      isError={isError}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      emptyTitle="还没有创建过帖子"
      errorTitle="该用户未公开创建的帖子"
    />
  );
}
