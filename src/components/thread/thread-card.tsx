/** 主题帖卡片组件：展示标题、分类、状态、作者、预览、成员/楼层数 */

"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Users, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMarkdownPreview } from "@/lib/markdown-preview";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { ThreadCardData } from "@/api/hooks/use-threads";
import { floorsQueryOptions } from "@/api/hooks/use-floors";
import { TopicTagLink } from "./topic-tag-link";

const categoryLabel: Record<string, string> = {
  DEDUCTION: "演绎",
  NATION: "国策",
  RPG: "RPG",
};

const categoryColor: Record<string, string> = {
  DEDUCTION:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  NATION: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  RPG: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

const statusLabel: Record<string, string> = {
  RECRUITING: "招募中",
  CLOSED: "已停招",
  FINISHED: "已结束",
};

const statusColor: Record<string, string> = {
  RECRUITING:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CLOSED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  FINISHED: "bg-muted text-muted-foreground",
};

interface ThreadCardProps {
  thread: ThreadCardData;
}

export function ThreadCard({ thread }: ThreadCardProps) {
  const queryClient = useQueryClient();
  const prefetchThread = () => {
    // 详情接口会记录浏览量，不能在悬停/聚焦时调用；楼层列表是无副作用查询。
    if (thread.defaultSubthread?.id) {
      void queryClient.prefetchInfiniteQuery(
        floorsQueryOptions(thread.defaultSubthread.id),
      );
    }
  };

  return (
    <article className="relative rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-3">
        {/* 第一行：分类 + 状态 */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              categoryColor[thread.category] ??
                "bg-muted text-muted-foreground",
            )}
          >
            {categoryLabel[thread.category] ?? thread.category}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              statusColor[thread.status] ?? "bg-muted text-muted-foreground",
            )}
          >
            {statusLabel[thread.status] ?? thread.status}
          </span>
          {thread.pinned && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              置顶
            </span>
          )}
        </div>

        {/* 标题 */}
        <h3 className="text-base font-semibold leading-snug text-foreground line-clamp-1">
          <Link
            href={`/threads/${thread.id}`}
            aria-label={`查看主题帖：${thread.title}`}
            onMouseEnter={prefetchThread}
            onFocus={prefetchThread}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {thread.title}
          </Link>
        </h3>

        {/* 预览摘要 */}
        {thread.preview && (
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
            {formatMarkdownPreview(thread.preview)}
          </p>
        )}

        {/* 标签 */}
        {thread.topicTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {thread.topicTags.map(({ tag }) => (
              <TopicTagLink key={tag.id} tag={tag} className="relative z-10" />
            ))}
          </div>
        )}

        {/* 底部信息 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {thread._count.players}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {thread._count.posts}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <UserAvatar
                name={thread.owner.username}
                src={thread.owner.avatar}
                className="h-6 w-6"
                textClassName="text-[10px]"
              />
              {thread.owner.username}
            </span>
            <span>
              {formatDistanceToNow(new Date(thread.updatedAt), {
                addSuffix: true,
                locale: zhCN,
              })}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
