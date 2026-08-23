"use client";

import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/errors";
import type { MomentCard as MomentCardData } from "@/api/hooks/use-moments";
import { useMomentBookmark } from "@/api/hooks/use-moments";
import {
  type BookmarkFolder,
  useMoveMomentBookmark,
} from "@/api/hooks/use-bookmark-folders";
import { MomentCard } from "@/components/moment/moment-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BookmarkedMoment = MomentCardData & { bookmarkFolderId: string };

export function BookmarkMomentCard({
  moment,
  folders,
}: {
  moment: BookmarkedMoment;
  folders: BookmarkFolder[];
}) {
  const move = useMoveMomentBookmark();
  const remove = useMomentBookmark(moment.id, true);

  return (
    <div className="rounded-xl border-b border-border/80 pb-2">
      <MomentCard moment={moment} />
      <div className="flex items-center justify-end gap-1.5 px-0.5">
        <Select
          items={folders.map((folder) => ({ value: folder.id, label: folder.name }))}
          value={moment.bookmarkFolderId}
          onValueChange={(folderId) => {
            if (!folderId || folderId === moment.bookmarkFolderId) return;
            move.mutate(
              { momentId: moment.id, folderId },
              {
                onSuccess: () => toast.success("已移动收藏"),
                onError: (error) => toast.error(getApiErrorMessage(error, "移动收藏失败")),
              },
            );
          }}
          disabled={moment.canInteract === false || move.isPending || remove.isPending}
        >
          <SelectTrigger
            size="compact"
            className="max-w-36 font-utility text-xs font-normal text-muted-foreground"
            aria-label={`移动“${moment.title}”到收藏夹`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {folders.map((folder) => (
              <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          title="取消收藏"
          aria-label={`取消收藏“${moment.title}”`}
          disabled={move.isPending || remove.isPending}
          onClick={() => {
            remove.mutate(undefined, {
              onError: (error) => toast.error(getApiErrorMessage(error, "取消收藏失败")),
            });
          }}
          className="shrink-0 rounded p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </div>
    </div>
  );
}
