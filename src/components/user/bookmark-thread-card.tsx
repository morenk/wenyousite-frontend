/** 收藏帖卡片：分类徽章 + 标题 + 作者 + 时间 + 可选取消收藏按钮 */

"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThreadOwner } from "@/api/hooks/use-threads";

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

interface BookmarkThreadCardProps {
  thread: {
    id: string;
    title: string;
    category: string;
    createdAt: string;
    owner: ThreadOwner;
    bookmarkId?: string;
  };
  onUnbookmark?: (bookmarkId: string) => void;
  isUnbookmarking?: boolean;
}

export function BookmarkThreadCard({
  thread,
  onUnbookmark,
  isUnbookmarking = false,
}: BookmarkThreadCardProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
      <Link href={`/threads/${thread.id}`} className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              categoryColor[thread.category] ?? "bg-muted text-muted-foreground",
            )}
          >
            {categoryLabel[thread.category] ?? thread.category}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-foreground line-clamp-1">
          {thread.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {thread.owner.username} ·{" "}
          {formatDistanceToNow(new Date(thread.createdAt), {
            addSuffix: true,
            locale: zhCN,
          })}
        </p>
      </Link>
      {onUnbookmark && thread.bookmarkId && (
        <button
          type="button"
          title="取消收藏"
          onClick={() => onUnbookmark(thread.bookmarkId!)}
          disabled={isUnbookmarking}
          className="shrink-0 rounded p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
        >
          {isUnbookmarking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}
