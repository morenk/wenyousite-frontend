"use client";

import Link from "next/link";
import type { BookmarkedThread } from "@/api/hooks/use-bookmarks";
import { useBookmarkActions } from "@/api/hooks/use-bookmark-actions";
import { useMoveBookmark, type BookmarkFolder } from "@/api/hooks/use-bookmark-folders";
import { ThreadCategoryBadge } from "@/components/thread/thread-category";
import { LevelBadge } from "@/components/shared/level-badge";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { BookmarkActionsMenu } from "@/components/user/bookmark-actions-menu";

export function BookmarkThreadCard({ thread, folders = [], showFolder = false }: {
  thread: BookmarkedThread;
  folders?: BookmarkFolder[];
  showFolder?: boolean;
}) {
  const { add, remove } = useBookmarkActions(thread.id);
  const move = useMoveBookmark();
  const folder = folders.find((item) => item.id === thread.bookmarkFolderId);
  return (
    <div className="flex w-full items-start justify-between gap-4 border-b border-border py-5">
      <div className="min-w-0 flex-1">
        <Link href={`/threads/${thread.id}`} className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <h3 className="break-words text-base font-semibold text-foreground hover:text-brand-strong">{thread.title}</h3>
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{thread.owner.username}</span><LevelBadge level={thread.owner.level} />
          <ThreadCategoryBadge category={thread.category} categoryInfo={thread.categoryInfo} />
          <WenyouTime value={thread.createdAt} />
          {showFolder && folder ? <span className="min-w-0 break-words">{folder.name}</span> : null}
        </div>
      </div>
      <BookmarkActionsMenu title={thread.title} folderId={thread.bookmarkFolderId}
        pending={add.isPending || remove.isPending || move.isPending}
        onMove={(folderId) => move.mutateAsync({ bookmarkId: thread.bookmarkId, folderId })}
        onRemove={() => remove.mutateAsync(thread.bookmarkId)}
        onRestore={() => add.mutateAsync(thread.bookmarkFolderId)} />
    </div>
  );
}
