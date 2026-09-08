"use client";

import { Loader2, Plus, RotateCw } from "lucide-react";
import { useState } from "react";
import {
  useBookmarkFolders,
  type BookmarkFolder,
  type BookmarkFolderKind,
} from "@/api/hooks/use-bookmark-folders";
import { BookmarkFolderForm } from "@/components/user/bookmark-folder-form";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/api/errors";

export function BookmarkFolderPickerDialog({
  open,
  onOpenChange,
  contentLabel,
  isPending,
  onConfirm,
  kind = "threads",
  intent = "collect",
  initialFolderId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentLabel: string;
  isPending: boolean;
  onConfirm: (folderId: string) => Promise<void>;
  kind?: BookmarkFolderKind;
  intent?: "collect" | "move";
  initialFolderId?: string;
}) {
  const folders = useBookmarkFolders(kind, open);
  const folderLabel = kind === "moments" ? "动态收藏夹" : "主题帖收藏夹";
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [createdFolder, setCreatedFolder] = useState<BookmarkFolder>();
  const folderOptions = createdFolder && !folders.data?.some((folder) => folder.id === createdFolder.id)
    ? [...(folders.data ?? []), createdFolder]
    : (folders.data ?? []);
  const effectiveSelectedId = selectedId
    ?? initialFolderId
    ?? folderOptions.find((folder) => folder.isDefault)?.id
    ?? folderOptions[0]?.id;

  const changeOpen = (next: boolean) => {
    if (isPending) return;
    if (!next) {
      setSearch("");
      setError(undefined);
      setSelectedId(undefined);
      setCreating(false);
      setCreatedFolder(undefined);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (!effectiveSelectedId || isPending || (intent === "move" && effectiveSelectedId === initialFolderId)) return;
    setError(undefined);
    try {
      await onConfirm(effectiveSelectedId);
      changeOpen(false);
    } catch (error) {
      setError(getApiErrorMessage(error, intent === "move" ? "移动收藏失败，请重试" : "收藏失败，请重试"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup className="max-w-md overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div className="min-w-0">
                <DialogTitle>{intent === "move" ? "移动到收藏夹" : "收藏到"}</DialogTitle>
                <DialogDescription className="mt-1 line-clamp-2">
                  {contentLabel}
                </DialogDescription>
              </div>
              <DialogCloseButton label="关闭收藏夹选择" disabled={isPending} />
            </div>

            <div className="px-4 py-4 sm:px-6">
              {folders.isLoading ? (
                <div className="space-y-2" role="status" aria-label="正在加载收藏夹">
                  {[0, 1, 2].map((item) => <Skeleton key={item} className="h-12 rounded-xl" />)}
                </div>
              ) : folders.isError ? (
                <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-muted-foreground">收藏夹加载失败，请重试。</p>
                  <Button variant="outline" size="compact" onClick={() => void folders.refetch()}>
                    <RotateCw />重试
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input type="search" aria-label="搜索收藏夹" placeholder="搜索收藏夹" value={search} disabled={isPending} onChange={(event) => setSearch(event.target.value)} />
                  <div className="max-h-72 space-y-1 overflow-y-auto" role="radiogroup" aria-label="选择收藏夹">
                    {folderOptions.filter((folder) => folder.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map((folder) => {
                      const selected = folder.id === effectiveSelectedId;
                      return (
                        <label
                          key={folder.id}
                          className={cn(
                            "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 outline-none transition-colors hover:bg-muted focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
                            selected && "border-secondary-foreground/15 bg-secondary text-secondary-foreground",
                          )}
                        >
                          <input
                            type="radio"
                            name="bookmark-folder"
                            value={folder.id}
                            checked={selected}
                            disabled={isPending}
                            onChange={() => setSelectedId(folder.id)}
                            className="sr-only"
                          />
                          <span className="flex size-8 items-center justify-center rounded-lg bg-background/75 text-muted-foreground">
                            <WenyouIcon id={selected ? "content.folder-open" : "content.folder"} />
                          </span>
                          <span className="min-w-0 flex-1 break-words text-sm font-semibold">{folder.name}</span>
                          {folder.isDefault ? (
                            <span className="font-utility text-[0.6875rem] text-muted-foreground">默认</span>
                          ) : null}
                          {selected ? <WenyouIcon id="action.confirm" className="size-4" /> : null}
                        </label>
                      );
                    })}
                    {!folderOptions.some((folder) => folder.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ? <p role="status" className="py-6 text-center text-sm text-muted-foreground">没有匹配的收藏夹</p> : null}
                  </div>

                  {creating ? (
                    <div className="rounded-xl bg-muted/55 p-4">
                      <BookmarkFolderForm
                        autoFocus
                        kind={kind}
                        onCancel={() => setCreating(false)}
                        onCreated={(folder) => {
                          setCreatedFolder(folder);
                          setSearch("");
                          setSelectedId(folder.id);
                          setCreating(false);
                        }}
                      />
                    </div>
                  ) : (
                    <Button variant="ghost" size="compact" disabled={isPending} onClick={() => setCreating(true)}>
                      <Plus />新建{folderLabel}
                    </Button>
                  )}
                </div>
              )}
            </div>
            {error ? <p role="alert" className="px-6 pb-4 text-sm text-destructive">{error}</p> : null}

            <DialogFooter className="border-t border-border bg-muted/35 px-6 py-4">
              <DialogClose
                type="button"
                disabled={isPending}
                className={buttonVariants({ variant: "ghost", size: "compact" })}
              >
                取消
              </DialogClose>
              <Button
                type="button"
                size="compact"
                disabled={!effectiveSelectedId || folders.isError || folders.isLoading || isPending || (intent === "move" && effectiveSelectedId === initialFolderId)}
                onClick={() => void submit()}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <WenyouIcon id="action.bookmark" />}
                {intent === "move" ? "移动" : "收藏"}
              </Button>
            </DialogFooter>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
