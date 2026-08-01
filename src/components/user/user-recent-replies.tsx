/** 用户最近动态列表：楼层/楼中楼标识 + 帖子链接 + 纯文本预览 */

"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MessageSquare, CornerDownRight } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { RecentReply } from "@/api/hooks/use-user-recent-replies";

interface UserRecentRepliesProps {
  replies: RecentReply[];
  isLoading: boolean;
  error: boolean;
}

export function UserRecentReplies({
  replies,
  isLoading,
  error,
}: UserRecentRepliesProps) {
  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>;
  }

  if (error) {
    return <EmptyState title="该用户未公开最近动态" />;
  }

  if (replies.length === 0) {
    return <EmptyState title="还没有发布过回复" />;
  }

  return (
    <div className="space-y-3">
      {replies.map((reply) => (
        <div
          key={reply.id}
          className="rounded-lg border border-border bg-card p-3"
        >
          <div className="mb-1 flex items-center justify-between">
            <Link
              href={`/threads/${reply.threadId}`}
              className="text-xs font-medium text-muted-foreground hover:text-primary"
            >
              {reply.thread.title}
            </Link>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5">
                {reply.parentPostId ? (
                  <CornerDownRight className="h-3.5 w-3.5" />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5" />
                )}
                <span data-testid="reply-kind">
                  {reply.floorNumber != null ? `#${reply.floorNumber}` : "楼中楼"}
                </span>
              </span>
              <span>·</span>
              {formatDistanceToNow(new Date(reply.createdAt), {
                addSuffix: true,
                locale: zhCN,
              })}
            </span>
          </div>
          <p className="line-clamp-2 text-sm text-foreground/90">
            {reply.preview || reply.content}
          </p>
        </div>
      ))}
    </div>
  );
}
