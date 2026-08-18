"use client";

import { Loader2, Plus, RotateCw } from "lucide-react";
import { useState } from "react";
import {
  useBookmarkFolders,
  type BookmarkFolder,
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

export function BookmarkFolderPickerDialog({
  open,
  onOpenChange,
  contentLabel,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentLabel: string;
  isPending: boolean;
  onConfirm: (folderId: string) => Promise<void>;
}) {
  const folders = useBookmarkFolders(open);
  const [selectedId, setSelectedId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [createdFolder, setCreatedFolder] = useState<BookmarkFolder>();
  const folderOptions = createdFolder && !folders.data?.some((folder) => folder.id === createdFolder.id)
    ? [...(folders.data ?? []), createdFolder]
    : (folders.data ?? []);
  const effectiveSelectedId = selectedId
    ?? folderOptions.find((folder) => folder.isDefault)?.id
    ?? folderOptions[0]?.id;

  const changeOpen = (next: boolean) => {
    if (isPending) return;
    if (!next) {
      setSelectedId(undefined);
      setCreating(false);
      setCreatedFolder(undefined);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (!effectiveSelectedId || isPending) return;
    try {
      await onConfirm(effectiveSelectedId);
      changeOpen(false);
    } catch {
      // 调用方保留业务错误文案，失败时弹窗保持打开。
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
                <DialogTitle>收藏到</DialogTitle>
                <DialogDescription className="mt-1 line-clamp-2">
                  为“{contentLabel}”选择一个收藏夹。
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
                  <div className="max-h-72 space-y-1 overflow-y-auto" role="radiogroup" aria-label="选择收藏夹">
                    {folderOptions.map((folder) => {
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
                            onChange={() => setSelectedId(folder.id)}
                            className="sr-only"
                          />
                          <span className="flex size-8 items-center justify-center rounded-lg bg-background/75 text-muted-foreground">
                            <WenyouIcon id={selected ? "content.folder-open" : "content.folder"} />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{folder.name}</span>
                          {folder.isDefault ? (
                            <span className="font-utility text-[0.6875rem] text-muted-foreground">默认</span>
                          ) : null}
                          {selected ? <WenyouIcon id="action.confirm" className="size-4" /> : null}
                        </label>
                      );
                    })}
                  </div>

                  {creating ? (
                    <div className="rounded-xl bg-muted/55 p-4">
                      <BookmarkFolderForm
                        autoFocus
                        onCancel={() => setCreating(false)}
                        onCreated={(folder) => {
                          setCreatedFolder(folder);
                          setSelectedId(folder.id);
                          setCreating(false);
                        }}
                      />
                    </div>
                  ) : (
                    <Button variant="ghost" size="compact" onClick={() => setCreating(true)}>
                      <Plus />新建收藏夹
                    </Button>
                  )}
                </div>
              )}
            </div>

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
                disabled={!effectiveSelectedId || folders.isError || folders.isLoading || isPending}
                onClick={() => void submit()}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <WenyouIcon id="action.bookmark" />}
                收藏
              </Button>
            </DialogFooter>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
