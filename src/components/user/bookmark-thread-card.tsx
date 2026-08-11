/** 收藏帖卡片：分类徽章 + 标题 + 作者 + 时间 + 可选取消收藏按钮 */

"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Loader2, Trash2 } from "lucide-react";
import type { ThreadCategory } from "@/lib/thread-presentation";
import { ThreadCategoryBadge } from "@/components/thread/thread-category";
import type { ThreadOwner } from "@/api/hooks/use-threads";
import { LevelBadge } from "@/components/shared/level-badge";
import type { BookmarkFolder } from "@/api/hooks/use-bookmark-folders";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BookmarkThreadCardProps {
  thread: {
    id: string;
    title: string;
    category: ThreadCategory | null;
    createdAt: string;
    owner: ThreadOwner;
    bookmarkId?: string;
    bookmarkFolderId?: string;
  };
  folders?: BookmarkFolder[];
  onMove?: (bookmarkId: string, folderId: string) => void;
  onUnbookmark?: (bookmarkId: string, threadId: string) => void;
  isMoving?: boolean;
  isUnbookmarking?: boolean;
}

export function BookmarkThreadCard({
  thread,
  folders = [],
  onMove,
  onUnbookmark,
  isMoving = false,
  isUnbookmarking = false,
}: BookmarkThreadCardProps) {
  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent/20">
      <Link href={`/threads/${thread.id}`} className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <ThreadCategoryBadge category={thread.category} />
        </div>
        <h3 className="font-display text-base font-bold text-foreground line-clamp-1">
          {thread.title}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {thread.owner.username} <LevelBadge level={thread.owner.level} /> ·{" "}
          {formatDistanceToNow(new Date(thread.createdAt), {
            addSuffix: true,
            locale: zhCN,
          })}
        </p>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        {onMove && thread.bookmarkId && thread.bookmarkFolderId && folders.length > 0 ? (
          <Select
            items={folders.map((folder) => ({ value: folder.id, label: folder.name }))}
            value={thread.bookmarkFolderId}
            onValueChange={(folderId) => {
              if (folderId && folderId !== thread.bookmarkFolderId) {
                onMove(thread.bookmarkId!, folderId);
              }
            }}
            disabled={isMoving}
          >
            <SelectTrigger
              size="compact"
              className="max-w-36 font-utility text-xs font-normal text-muted-foreground"
              aria-label={`移动“${thread.title}”到收藏夹`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {onUnbookmark && thread.bookmarkId && (
          <button
            type="button"
            title="取消收藏"
            aria-label={`取消收藏“${thread.title}”`}
            onClick={() => onUnbookmark(thread.bookmarkId!, thread.id)}
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
    </div>
  );
}
