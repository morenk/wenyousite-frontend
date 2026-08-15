"use client";

import { ChevronUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  type MomentComment,
  type MomentRootComment,
  useMomentReplies,
} from "@/api/hooks/use-moments";
import type { ReplyFilters } from "@/api/reply-query";
import { useAuth } from "@/lib/auth";
import { MomentCommentRow } from "@/components/moment/moment-comment-row";
import type { MomentReplyTarget } from "@/components/moment/moment-comment-types";

const LARGE_REPLY_THREAD_THRESHOLD = 10;

export function MomentCommentThread({
  momentId,
  comment,
  filters,
  onReply,
  focusedCommentId,
  focusedReply,
}: {
  momentId: string;
  comment: MomentRootComment;
  filters: ReplyFilters;
  onReply: (target: MomentReplyTarget) => void;
  focusedCommentId?: string;
  focusedReply?: MomentComment;
}) {
  const { user } = useAuth();
  const targetReplyId = focusedCommentId && focusedCommentId !== comment.id
    ? focusedCommentId
    : null;
  const [expanded, setExpanded] = useState(() => !!targetReplyId);
  const threadRef = useRef<HTMLElement | null>(null);
  const repliesQuery = useMomentReplies(momentId, comment.id, user?.id, expanded, filters);
  const expandedReplies = repliesQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const loadedReplies = expanded
    ? repliesQuery.data ? expandedReplies : comment.replies
    : comment.replies;
  const injectedFocusedReply = expanded && focusedReply?.id === targetReplyId &&
      focusedReply.parentCommentId === comment.id &&
      !loadedReplies.some((reply) => reply.id === focusedReply.id)
    ? focusedReply
    : null;
  const replies = injectedFocusedReply
    ? [injectedFocusedReply, ...loadedReplies]
    : loadedReplies;
  const isLargeExpandedThread = expanded && comment.replyCount > LARGE_REPLY_THREAD_THRESHOLD;

  const collapseReplies = () => {
    setExpanded(false);
    window.requestAnimationFrame(() => {
      threadRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  };

  return (
    <article ref={threadRef} className="scroll-mt-6 py-5">
      <MomentCommentRow
        momentId={momentId}
        comment={comment}
        onReply={onReply}
        focused={focusedCommentId === comment.id}
      />
      {replies.length > 0 ? (
        <div className="ml-10 mt-3 space-y-3 rounded-2xl bg-muted/55 px-4 py-3">
          {isLargeExpandedThread ? (
            <div data-slot="moment-replies-collapse-dock" className="pointer-events-none sticky top-4 z-20 mb-2 flex h-8 justify-end">
              <button
                type="button"
                onClick={collapseReplies}
                aria-label={`收起 ${comment.replyCount} 条回复`}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur-xl transition-[background-color,color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-background hover:text-brand-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <ChevronUp className="size-3.5" />
                收起 {comment.replyCount} 条回复
              </button>
            </div>
          ) : null}
          {replies.map((reply) => (
            <MomentCommentRow
              key={reply.id}
              momentId={momentId}
              comment={reply}
              compact
              onReply={onReply}
              focused={focusedCommentId === reply.id}
            />
          ))}
          {!expanded && comment.replyCount > comment.replies.length ? (
            <button type="button" onClick={() => setExpanded(true)} className="text-xs font-semibold text-brand-strong hover:underline">
              展开全部 {comment.replyCount} 条回复
            </button>
          ) : null}
          {expanded && repliesQuery.hasNextPage ? (
            <button
              type="button"
              disabled={repliesQuery.isFetchingNextPage}
              onClick={() => void repliesQuery.fetchNextPage()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline disabled:opacity-50"
            >
              {repliesQuery.isFetchingNextPage && <Loader2 className="size-3 animate-spin" />}
              继续加载
            </button>
          ) : null}
          {expanded && !isLargeExpandedThread ? (
            <button type="button" onClick={collapseReplies} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline">
              <ChevronUp className="size-3" />收起回复
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
