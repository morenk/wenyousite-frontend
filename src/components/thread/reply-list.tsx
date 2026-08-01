/** 楼中楼回复列表组件：展开回复 + 加载更多 + 回复串内对用户回复 */

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Loader2, ChevronDown, MessageSquare } from "lucide-react";
import { useReplies } from "@/api/hooks/use-replies";
import { useAuth } from "@/lib/auth";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { ReplyForm } from "@/components/thread/reply-form";
import { Button } from "@/components/ui/button";
import type { PostData } from "@/api/hooks/use-floors";

interface ReplyListProps {
  postId: string;
}

export function ReplyList({ postId }: ReplyListProps) {
  const { user } = useAuth();
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useReplies(postId);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const replies = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  return (
    <div className="mt-3 space-y-2 border-l-2 border-border pl-3">
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
        <p className="py-2 text-xs text-muted-foreground">还没有回复</p>
      )}

      {replies.map((reply: PostData) => {
        const replyToUser = reply.replyToPost?.author?.username;
        const replyToId = reply.replyToPost?.id ?? reply.replyToPostId;
        return (
          <div
            key={reply.id}
            className="rounded-lg border border-border bg-background p-3"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Link
                  href={`/users/${reply.authorId}`}
                  className="text-xs font-medium text-foreground hover:text-primary"
                >
                  {reply.author.username}
                </Link>
                {replyToUser && replyToId && (
                  <span className="text-xs text-muted-foreground">
                    回复{" "}
                    <Link
                      href={`/users/${reply.replyToPost?.authorId ?? ""}`}
                      className="text-muted-foreground hover:text-primary"
                    >
                      @{replyToUser}
                    </Link>
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(reply.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </div>
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    setReplyingToId((id) =>
                      id === reply.id ? null : reply.id,
                    )
                  }
                >
                  <MessageSquare className="mr-1 h-3.5 w-3.5" />
                  回复
                </Button>
              )}
            </div>
            <MarkdownContent content={reply.content} />
            {replyingToId === reply.id && (
              <ReplyForm
                subthreadId={reply.subthreadId}
                parentPostId={postId}
                replyToPostId={reply.id}
                replyToLabel={`@${reply.author.username}`}
                onReplied={() => setReplyingToId(null)}
              />
            )}
          </div>
        );
      })}

      {/* 加载更多 sentinel */}
      <div ref={sentinelRef} className="flex items-center justify-center py-2">
        {isFetchingNextPage && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {hasNextPage && !isFetchingNextPage && (
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
        {!hasNextPage && replies.length > 0 && (
          <span className="text-xs text-muted-foreground">没有更多了</span>
        )}
      </div>
    </div>
  );
}
