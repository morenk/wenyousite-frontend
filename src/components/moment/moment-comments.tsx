"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  type MomentRootComment,
  useMomentCommentContext,
  useMomentComments,
} from "@/api/hooks/use-moments";
import { FloatingInputDock } from "@/components/shared/floating-input-dock";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getApiError } from "@/api/errors";
import type { ReplyFilters, ReplyOrder } from "@/api/reply-query";
import { MomentCommentForm } from "@/components/moment/moment-comment-form";
import { MomentCommentThread } from "@/components/moment/moment-comment-thread";
import type { MomentReplyTarget } from "@/components/moment/moment-comment-types";
import { ChronologicalOrderToggle } from "@/components/shared/chronological-order-toggle";

export function MomentComments({ momentId }: { momentId: string }) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<ReplyOrder>("NEWEST");
  const filters = useMemo<ReplyFilters>(() => ({ order }), [order]);
  const commentsQuery = useMomentComments(momentId, user?.id, filters);
  const commentPages = commentsQuery.data?.pages;
  const comments = useMemo(
    () => commentPages?.flatMap((page) => page.data) ?? [],
    [commentPages],
  );
  const [replyTarget, setReplyTarget] = useState<MomentReplyTarget>(null);
  const rootCommentParam = searchParams.get("comment");
  const replyParam = rootCommentParam ? searchParams.get("reply") : null;
  const targetCommentId = replyParam ?? rootCommentParam ?? undefined;
  const contextQuery = useMomentCommentContext(momentId, targetCommentId, user?.id);
  const context = contextQuery.data;
  const focusedRoot = useMemo<MomentRootComment | null>(() => context ? {
    ...context.root,
    replyCount: context.replyCount,
    replies: context.target.parentCommentId ? [context.target] : [],
  } : null, [context]);
  const displayedComments = useMemo(() => {
    if (!focusedRoot || comments.some((comment) => comment.id === focusedRoot.id)) {
      return comments;
    }
    return [focusedRoot, ...comments];
  }, [comments, focusedRoot]);
  const focusedRootId = context?.root.id;
  const focusedCommentId = context?.target.id;
  const focusedReply = context?.target.parentCommentId ? context.target : undefined;
  const contextError = getApiError(contextQuery.error);
  const targetUnavailable = contextError.code === 40400 || contextError.status === 404;
  const showCommentsLoading = commentsQuery.isLoading && displayedComments.length === 0;
  const showCommentsError = commentsQuery.isError && displayedComments.length === 0;

  return (
    <section id="comments" className="scroll-mt-6 pt-5" aria-label="动态回复">
      <div className="flex justify-end">
        <ChronologicalOrderToggle
          order={order}
          onOrderChange={setOrder}
          accessibleName="评论排序"
        />
      </div>

      {targetCommentId && contextQuery.isLoading ? (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-muted/45 px-4 py-3 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" />
          正在定位目标回复…
        </div>
      ) : null}

      {contextQuery.isError ? (
        <div
          className="mt-4 rounded-xl border border-border/70 bg-muted/35 px-4 py-3 text-center text-sm text-muted-foreground"
          role={targetUnavailable ? "status" : "alert"}
        >
          <p>{targetUnavailable ? "目标回复不存在或不可见" : "定位目标回复失败"}</p>
          {!targetUnavailable ? (
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => void contextQuery.refetch()}>
              重试定位
            </Button>
          ) : null}
        </div>
      ) : null}

      {showCommentsLoading ? (
        <div className="flex justify-center py-14" role="status">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : showCommentsError ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">评论加载失败</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => void commentsQuery.refetch()}>重试</Button>
        </div>
      ) : displayedComments.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">还没有评论</p>
      ) : (
        <div className="mt-4 divide-y divide-border/70">
          {displayedComments.map((comment) => (
            <MomentCommentThread
              key={`${comment.id}:${comment.id === focusedRootId ? focusedCommentId ?? "" : ""}`}
              momentId={momentId}
              comment={comment}
              filters={filters}
              onReply={setReplyTarget}
              focusedCommentId={comment.id === focusedRootId ? focusedCommentId : undefined}
              focusedReply={comment.id === focusedRootId ? focusedReply : undefined}
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
