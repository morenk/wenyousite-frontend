"use client";

import { useState } from "react";
import type { BookmarkFolder, BookmarkFolderKind } from "@/api/hooks/use-bookmark-folders";
import { CreateBookmarkFolderButton } from "@/components/user/create-bookmark-folder-button";
import { Input } from "@/components/ui/input";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { WenyouCount } from "@/components/shared/wenyou-count";
import { cn } from "@/lib/utils";

export function BookmarkFolderBar({ folders, selectedFolderId, onSelect, kind = "threads" }: {
  folders: BookmarkFolder[];
  selectedFolderId?: string;
  onSelect: (folderId?: string) => void;
  kind?: BookmarkFolderKind;
}) {
  const [search, setSearch] = useState("");
  const options = [
    { id: undefined, name: "全部收藏", itemCount: folders.reduce((sum, folder) => sum + folder.itemCount, 0), isDefault: false },
    ...folders.filter((folder) => folder.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Input type="search" aria-label="搜索收藏夹" placeholder="搜索收藏夹" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" role="group" aria-label={kind === "moments" ? "动态收藏夹" : "主题帖收藏夹"}>
        {options.map((folder) => {
          const active = selectedFolderId === folder.id;
          return (
            <button key={folder.id ?? "all"} type="button" aria-pressed={active} onClick={() => onSelect(folder.id)}
              className={cn("flex min-h-11 w-full items-center gap-2 border-l-2 border-transparent px-3 py-2 text-left text-sm text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", active && "border-brand-strong bg-primary/30 font-semibold text-foreground")}>
              <WenyouIcon id={active ? "content.folder-open" : "content.folder"} className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 break-words">{folder.name}</span>
              <WenyouCount value={folder.itemCount} label="收藏数量" className="shrink-0 text-xs text-muted-foreground" />
            </button>
          );
        })}
        {options.length === 1 && search.trim() ? <p role="status" className="px-3 py-6 text-sm text-muted-foreground">没有匹配的收藏夹</p> : null}
      </div>
      <div className="border-t border-border pt-3">
        <CreateBookmarkFolderButton kind={kind} onCreated={(folder) => { setSearch(""); onSelect(folder.id); }} />
      </div>
    </div>
  );
}
