/** 楼中楼回复列表组件：展开回复 + 加载更多 + 回复串内对用户回复 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useReplies } from "@/api/hooks/use-replies";
import { Button } from "@/components/ui/button";
import type { ReplyDisplayData } from "@/api/hooks/use-floors";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useMembers } from "@/api/hooks/use-members";
import {
  ReplyThreadControls,
  type ReplyAuthorOption,
} from "@/components/shared/reply-thread-controls";
import type { ReplyOrder } from "@/api/reply-query";
import { ReplyCard } from "@/components/thread/reply-card";

interface ReplyListProps {
  postId: string;
  threadId?: string;
  focusedReply?: ReplyDisplayData;
  variant?: "embedded" | "discussion";
}

export function ReplyList({ postId, threadId, focusedReply, variant = "embedded" }: ReplyListProps) {
  const [order, setOrder] = useState<ReplyOrder>("OLDEST");
  const [authorId, setAuthorId] = useState<string>();
  const filters = useMemo(() => ({ order, ...(authorId ? { authorId } : {}) }), [authorId, order]);
  const membersQuery = useMembers(variant === "discussion" ? threadId : undefined);
  const authorOptions = useMemo<ReplyAuthorOption[]>(() => {
    const roleRank = { OWNER: 0, COLLABORATOR: 1, PARTICIPANT: 2 } as const;
    return (membersQuery.data ?? [])
      .filter((member) => member.playerMarked || member.role === "OWNER" || member.role === "COLLABORATOR")
      .sort((first, second) =>
        roleRank[first.role] - roleRank[second.role] ||
        first.user.username.localeCompare(second.user.username, "zh-CN"),
      )
      .map((member) => ({
        id: member.userId,
        username: member.user.username,
        detail: member.role === "OWNER" ? "楼主" : member.role === "COLLABORATOR" ? "协作者" : "玩家",
      }));
  }, [membersQuery.data]);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useReplies(postId, filters);

  const sentinelRef = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  const loadedReplies = data?.pages.flatMap((page) => page?.data ?? []) ?? [];
  const canShowFocusedReply = !authorId || focusedReply?.authorId === authorId;
  const replies = focusedReply && canShowFocusedReply && !loadedReplies.some((reply) => reply.id === focusedReply.id)
    ? [...loadedReplies, focusedReply]
    : loadedReplies;

  // 父楼展开、目标回复渲染完成后再执行第二阶段滚动，避免只停在父楼。
  useEffect(() => {
    if (!focusedReply) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`post-${focusedReply.id}`)?.scrollIntoView({
        behavior: "auto",
        block: "center",
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [focusedReply]);

  return (
    <div className={variant === "discussion" ? "space-y-3" : "mt-3 space-y-2 border-l-2 border-border pl-3"}>
      {variant === "discussion" ? (
        <ReplyThreadControls
          order={order}
          onOrderChange={setOrder}
          authorId={authorId}
          onAuthorChange={setAuthorId}
          authors={authorOptions}
          authorScopeLabel="全部玩家与管理者"
        />
      ) : null}

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between py-2">
          <p className="text-xs text-muted-foreground">回复加载失败</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            重试
          </Button>
        </div>
      )}

      {!isLoading && !error && replies.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground">
          {authorId ? "这位成员还没有回复" : "还没有回复"}
        </p>
      )}

      {replies.map((reply, index) => (
        <ReplyCard
          key={reply.id}
          reply={reply}
          parentPostId={postId}
          variant={variant}
          ordinal={variant === "discussion" ? index + 1 : undefined}
          focused={reply.id === focusedReply?.id}
        />
      ))}

      {hasNextPage || isFetchingNextPage ? (
        <div ref={sentinelRef} className="flex items-center justify-center py-2">
          {isFetchingNextPage ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              className="text-xs"
            >
              <ChevronDown className="mr-1 h-3.5 w-3.5" />
              加载更多回复
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
