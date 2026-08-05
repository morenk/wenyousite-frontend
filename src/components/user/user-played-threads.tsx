/** 用户参与的帖子列表（薄包装：useUserPlayedThreads + UserThreadList） */

"use client";

import { useState } from "react";
import { useUserPlayedThreads } from "@/api/hooks/use-user-played-threads";
import type { PlayedThreadVisibility } from "@/api/hooks/use-user-played-threads";
import { UserThreadList } from "@/components/user/user-thread-list";
import { Button } from "@/components/ui/button";

interface UserPlayedThreadsProps {
  userId: string;
  isSelf: boolean;
}

const filters: Array<{ label: string; value: PlayedThreadVisibility | undefined }> = [
  { label: "全部", value: undefined },
  { label: "公开帖", value: "PUBLIC" },
  { label: "私密帖", value: "PRIVATE" },
];

export function UserPlayedThreads({ userId, isSelf }: UserPlayedThreadsProps) {
  const [visibility, setVisibility] = useState<PlayedThreadVisibility>();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useUserPlayedThreads(userId, isSelf ? visibility : undefined);

  const threads = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  const emptyTitle = visibility === "PRIVATE"
    ? "还没有参与过私密帖"
    : visibility === "PUBLIC"
      ? "还没有参与过公开帖"
      : "还没有参与过帖子";

  return (
    <div className="space-y-4">
      {isSelf && (
        <div className="flex gap-1" role="group" aria-label="参与帖子分类">
          {filters.map((filter) => {
            const selected = visibility === filter.value;
            return (
              <Button
                key={filter.label}
                type="button"
                size="sm"
                variant={selected ? "secondary" : "ghost"}
                aria-pressed={selected}
                onClick={() => setVisibility(filter.value)}
              >
                {filter.label}
              </Button>
            );
          })}
        </div>
      )}
      <UserThreadList
        threads={threads}
        isLoading={isLoading}
        isError={isError}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        emptyTitle={emptyTitle}
        errorTitle={isSelf ? "参与的帖子加载失败" : "该用户未公开参与的帖子"}
      />
    </div>
  );
}
