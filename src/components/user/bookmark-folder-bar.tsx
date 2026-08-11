"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Folder, FolderOpen, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import {
  useCreateBookmarkFolder,
  type BookmarkFolder,
} from "@/api/hooks/use-bookmark-folders";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const folderSchema = z.object({
  name: z.string().trim().min(1, "请输入收藏夹名称").max(24, "名称最多 24 个字符"),
});

type FolderFormValues = z.infer<typeof folderSchema>;

interface BookmarkFolderBarProps {
  folders: BookmarkFolder[];
  selectedFolderId?: string;
  onSelect: (folderId?: string) => void;
}

export function BookmarkFolderBar({
  folders,
  selectedFolderId,
  onSelect,
}: BookmarkFolderBarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const createFolder = useCreateBookmarkFolder();
  const form = useForm<FolderFormValues>({
    resolver: zodResolver(folderSchema),
    defaultValues: { name: "" },
  });
  const total = folders.reduce((sum, folder) => sum + folder.bookmarkCount, 0);

  const options = [
    { id: undefined, name: "全部", bookmarkCount: total, isDefault: false },
    ...folders,
  ];

  return (
    <>
      <div className="mb-5 flex items-center gap-2 border-b border-border pb-3">
        <div
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
          role="group"
          aria-label="主题帖收藏夹"
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
                <span className="tabular-nums opacity-65">{folder.bookmarkCount}</span>
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="compact"
          onClick={() => setDialogOpen(true)}
        >
          <Plus />
          新建收藏夹
        </Button>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) form.reset();
        }}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogViewport>
            <DialogPopup className="max-w-sm p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle>新建收藏夹</DialogTitle>
                  <DialogDescription className="mt-1">
                    用分类把想继续阅读的主题帖收在一起。
                  </DialogDescription>
                </div>
                <DialogCloseButton type="button" label="关闭新建收藏夹" />
              </div>

              <form
                className="mt-5 space-y-4"
                onSubmit={form.handleSubmit(async ({ name }) => {
                  try {
                    const folder = await createFolder.mutateAsync(name.trim());
                    toast.success(`已新建“${folder.name}”`);
                    onSelect(folder.id);
                    setDialogOpen(false);
                    form.reset();
                  } catch (error) {
                    toast.error(getApiErrorMessage(error, "新建收藏夹失败"));
                  }
                })}
              >
                <div className="space-y-2">
                  <Label htmlFor="bookmark-folder-name">收藏夹名称</Label>
                  <Input
                    id="bookmark-folder-name"
                    autoFocus
                    placeholder="例如：跑团资料"
                    disabled={createFolder.isPending}
                    {...form.register("name")}
                  />
                  {form.formState.errors.name ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  ) : null}
                </div>
                <DialogFooter>
                  <DialogClose
                    type="button"
                    disabled={createFolder.isPending}
                    className={buttonVariants({ variant: "ghost", size: "compact" })}
                  >
                    取消
                  </DialogClose>
                  <Button type="submit" size="compact" disabled={createFolder.isPending}>
                    {createFolder.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                    新建
                  </Button>
                </DialogFooter>
              </form>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>
    </>
  );
}
