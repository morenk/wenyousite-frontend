/** 楼中楼回复列表组件：展开回复 + 加载更多 + 回复串内对用户回复 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useReplies } from "@/api/hooks/use-replies";
import { useReplyAuthors } from "@/api/hooks/use-discussion-authors";
import { Button } from "@/components/ui/button";
import type { ReplyDisplayData } from "@/api/hooks/use-floors";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { DiscussionListControls } from "@/components/shared/discussion-list-controls";
import type { ReplyOrder } from "@/api/reply-query";
import { ReplyCard } from "@/components/thread/reply-card";
import { useAuth } from "@/lib/auth";

interface ReplyListProps {
  postId: string;
  focusedReply?: ReplyDisplayData;
  variant?: "embedded" | "discussion";
}

export function ReplyList({ postId, focusedReply, variant = "embedded" }: ReplyListProps) {
  const { user } = useAuth();
  const [order, setOrder] = useState<ReplyOrder>("OLDEST");
  const [requestedAuthorId, setAuthorId] = useState<string>();
  const authorsQuery = useReplyAuthors(
    variant === "discussion" ? postId : undefined,
    user?.id,
  );
  const authorId = requestedAuthorId && (
    !authorsQuery.isSuccess ||
    authorsQuery.data.some((author) => author.id === requestedAuthorId)
  )
    ? requestedAuthorId
    : undefined;
  const filters = useMemo(() => ({ order, ...(authorId ? { authorId } : {}) }), [authorId, order]);
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
  const focusedReplyId = canShowFocusedReply ? focusedReply?.id : undefined;
  const targetRevealReleased = useRef(false);

  useEffect(() => {
    targetRevealReleased.current = false;
    if (!focusedReplyId) return;

    const release = () => {
      targetRevealReleased.current = true;
    };
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("pointerdown", release, { passive: true });
    window.addEventListener("keydown", release);
    return () => {
      window.removeEventListener("wheel", release);
      window.removeEventListener("pointerdown", release);
      window.removeEventListener("keydown", release);
    };
  }, [authorId, focusedReplyId, order, postId]);

  // 目标先于分页到达时，后续回复会插入它前方，需继续校准至用户接管滚动。
  useEffect(() => {
    if (!focusedReplyId || targetRevealReleased.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (targetRevealReleased.current) return;
      document.getElementById(`post-${focusedReplyId}`)?.scrollIntoView({
        behavior: "auto",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [authorId, focusedReplyId, loadedReplies.length, order, postId]);

  return (
    <div className={variant === "discussion" ? "space-y-3" : "mt-3 space-y-2 border-l-2 border-border pl-3"}>
      {variant === "discussion" ? (
        <DiscussionListControls
          subject="回复"
          order={order}
          onOrderChange={setOrder}
          authorId={authorId}
          onAuthorChange={setAuthorId}
          authors={authorsQuery.data ?? []}
          authorsLoading={authorsQuery.isLoading}
          authorsError={authorsQuery.isError}
          onRetryAuthors={() => void authorsQuery.refetch()}
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
