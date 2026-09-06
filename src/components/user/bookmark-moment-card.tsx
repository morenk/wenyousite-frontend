"use client";

import type { MomentCard as MomentCardData } from "@/api/hooks/use-moments";
import { useMomentBookmark } from "@/api/hooks/use-moments";
import { type BookmarkFolder, useMoveMomentBookmark } from "@/api/hooks/use-bookmark-folders";
import { MomentCard } from "@/components/moment/moment-card";
import { BookmarkActionsMenu } from "@/components/user/bookmark-actions-menu";

type BookmarkedMoment = MomentCardData & { bookmarkFolderId: string };

export function BookmarkMomentCard({ moment, folders, showFolder = false }: {
  moment: BookmarkedMoment;
  folders: BookmarkFolder[];
  showFolder?: boolean;
}) {
  const move = useMoveMomentBookmark();
  const remove = useMomentBookmark(moment.id, true);
  const restore = useMomentBookmark(moment.id, false);
  const folder = folders.find((item) => item.id === moment.bookmarkFolderId);
  return (
    <div className="border-b border-border pb-2">
      <MomentCard moment={moment} />
      <div className="flex items-center justify-end gap-2">
        {showFolder && folder ? <span className="min-w-0 flex-1 break-words text-xs text-muted-foreground">{folder.name}</span> : null}
        <BookmarkActionsMenu title={moment.title} folderId={moment.bookmarkFolderId} kind="moments"
          pending={move.isPending || remove.isPending || restore.isPending} canMove={moment.canInteract !== false}
          onMove={(folderId) => move.mutateAsync({ momentId: moment.id, folderId })}
          onRemove={() => remove.mutateAsync(undefined)}
          onRestore={() => restore.mutateAsync(moment.bookmarkFolderId)} />
      </div>
    </div>
  );
}
