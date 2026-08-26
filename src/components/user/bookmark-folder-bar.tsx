"use client";

import { Folder, FolderOpen } from "lucide-react";
import type {
  BookmarkFolder,
  BookmarkFolderKind,
} from "@/api/hooks/use-bookmark-folders";
import { CreateBookmarkFolderButton } from "@/components/user/create-bookmark-folder-button";
import { cn } from "@/lib/utils";

interface BookmarkFolderBarProps {
  folders: BookmarkFolder[];
  selectedFolderId?: string;
  onSelect: (folderId?: string) => void;
  kind?: BookmarkFolderKind;
}

export function BookmarkFolderBar({
  folders,
  selectedFolderId,
  onSelect,
  kind = "threads",
}: BookmarkFolderBarProps) {
  const total = folders.reduce((sum, folder) => sum + folder.itemCount, 0);
  const options = [
    { id: undefined, name: "全部", itemCount: total, isDefault: false },
    ...folders,
  ];

  return (
    <div className="mb-5 flex items-center gap-2 border-b border-border pb-3">
      <div
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
        role="group"
        aria-label={kind === "moments" ? "动态收藏夹" : "主题帖收藏夹"}
      >
        {options.map((folder) => {
          const active = selectedFolderId === folder.id;
          const FolderIcon = active ? FolderOpen : Folder;
          return (
            <button
              key={folder.id ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(folder.id)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 font-utility text-xs font-bold text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30",
                active && "bg-secondary text-secondary-foreground",
              )}
            >
              <FolderIcon className="size-3.5" />
              <span>{folder.name}</span>
              <span className="tabular-nums opacity-65">{folder.itemCount}</span>
            </button>
          );
        })}
      </div>
      <CreateBookmarkFolderButton
        kind={kind}
        onCreated={(folder) => onSelect(folder.id)}
      />
    </div>
  );
}
