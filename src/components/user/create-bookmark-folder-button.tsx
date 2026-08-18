"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import type { BookmarkFolder } from "@/api/hooks/use-bookmark-folders";
import { BookmarkFolderForm } from "@/components/user/bookmark-folder-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogCloseButton,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";

export function CreateBookmarkFolderButton({
  onCreated,
}: {
  onCreated?: (folder: BookmarkFolder) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="compact"
        onClick={() => setDialogOpen(true)}
      >
        <Plus />
        新建收藏夹
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
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
                    用分类把想继续阅读的主题帖和动态收在一起。
                  </DialogDescription>
                </div>
                <DialogCloseButton type="button" label="关闭新建收藏夹" />
              </div>

              <div className="mt-5">
                <BookmarkFolderForm
                  autoFocus
                  onCreated={(folder) => {
                    onCreated?.(folder);
                    setDialogOpen(false);
                  }}
                />
              </div>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>
    </>
  );
}
