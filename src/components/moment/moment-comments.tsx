"use client";

import { ArrowDownUp, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMomentComments } from "@/api/hooks/use-moments";
import { FloatingInputDock } from "@/components/shared/floating-input-dock";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import type { ReplyFilters, ReplyOrder } from "@/api/reply-query";
import { MomentCommentForm } from "@/components/moment/moment-comment-form";
import { MomentCommentThread } from "@/components/moment/moment-comment-thread";
import type { MomentReplyTarget } from "@/components/moment/moment-comment-types";

export function MomentComments({ momentId }: { momentId: string }) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<ReplyOrder>("NEWEST");
  const filters = useMemo<ReplyFilters>(() => ({ order }), [order]);
  const commentsQuery = useMomentComments(momentId, user?.id, filters);
  const comments = commentsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const [replyTarget, setReplyTarget] = useState<MomentReplyTarget>(null);
  const targetRootCommentId = searchParams.get("comment");
  const targetReplyId = targetRootCommentId ? searchParams.get("reply") : null;
  const targetRootLoaded = !!targetRootCommentId && comments.some(
    (comment) => comment.id === targetRootCommentId,
  );
  const loadedCommentPageCount = commentsQuery.data?.pages.length ?? 0;
  const requestedCommentPageCountRef = useRef<number | null>(null);

  useEffect(() => {
    requestedCommentPageCountRef.current = null;
  }, [order, targetRootCommentId]);

  useEffect(() => {
    if (
      !targetRootCommentId ||
      targetRootLoaded ||
      !commentsQuery.hasNextPage ||
      commentsQuery.isFetchingNextPage ||
      requestedCommentPageCountRef.current === loadedCommentPageCount
    ) return;
    requestedCommentPageCountRef.current = loadedCommentPageCount;
    void commentsQuery.fetchNextPage();
  }, [
    commentsQuery,
    loadedCommentPageCount,
    targetRootCommentId,
    targetRootLoaded,
  ]);

  return (
    <section id="comments" className="scroll-mt-6 pt-5" aria-label="动态回复">
      <div className="flex justify-end">
        <button
          type="button"
          aria-label={`评论排序：${order === "NEWEST" ? "最新在前" : "最早在前"}`}
          aria-pressed={order === "NEWEST"}
          title={order === "NEWEST" ? "切换为最早在前" : "切换为最新在前"}
          onClick={() => setOrder((current) => current === "NEWEST" ? "OLDEST" : "NEWEST")}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowDownUp className="size-3.5" />
          {order === "NEWEST" ? "最新在前" : "最早在前"}
        </button>
      </div>

      {commentsQuery.isLoading ? (
        <div className="flex justify-center py-14" role="status">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : commentsQuery.isError ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">评论加载失败</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => void commentsQuery.refetch()}>重试</Button>
        </div>
      ) : comments.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">还没有评论</p>
      ) : (
        <div className="mt-4 divide-y divide-border/70">
          {comments.map((comment) => (
            <MomentCommentThread
              key={`${comment.id}:${comment.id === targetRootCommentId ? targetReplyId ?? targetRootCommentId : ""}`}
              momentId={momentId}
              comment={comment}
              filters={filters}
              onReply={setReplyTarget}
              focusedCommentId={comment.id === targetRootCommentId
                ? targetReplyId ?? targetRootCommentId
                : undefined}
            />
          ))}
        </div>
      )}

      {commentsQuery.hasNextPage ? (
        <div className="flex justify-center py-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={commentsQuery.isFetchingNextPage}
            onClick={() => void commentsQuery.fetchNextPage()}
          >
            {commentsQuery.isFetchingNextPage ? <Loader2 className="animate-spin" /> : <ChevronDown />}
            加载更多评论
          </Button>
        </div>
      ) : null}

      <FloatingInputDock slotPrefix="floating-moment-comment">
        <MomentCommentForm
          momentId={momentId}
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
        />
      </FloatingInputDock>
    </section>
  );
}
