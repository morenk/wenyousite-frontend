/** 主题帖卡片组件：展示标题、分类、状态、作者、预览、成员/楼层数 */

"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Users, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { ThreadCardData } from "@/api/hooks/use-threads";

const categoryLabel: Record<string, string> = {
  DEDUCTION: "演绎",
  NATION: "国策",
  RPG: "RPG",
};

const categoryColor: Record<string, string> = {
  DEDUCTION: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  NATION: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  RPG: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

const statusLabel: Record<string, string> = {
  RECRUITING: "招募中",
  CLOSED: "已关闭",
  FINISHED: "已完结",
};

const statusColor: Record<string, string> = {
  RECRUITING: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CLOSED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  FINISHED: "bg-muted text-muted-foreground",
};

interface ThreadCardProps {
  thread: ThreadCardData;
}

export function ThreadCard({ thread }: ThreadCardProps) {
  return (
    <div>
      <Link
        href={`/threads/${thread.id}`}
        className="block rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex flex-col gap-3">
          {/* 第一行：分类 + 状态 */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                categoryColor[thread.category] ?? "bg-muted text-muted-foreground",
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
            {thread.title}
          </h3>

          {/* 预览摘要 */}
          {thread.preview && (
            <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
              {thread.preview}
            </p>
          )}

          {/* 标签 */}
          {thread.topicTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {thread.topicTags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground"
                >
                  #{tag.name}
                </span>
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
      </Link>
    </div>
  );
}
