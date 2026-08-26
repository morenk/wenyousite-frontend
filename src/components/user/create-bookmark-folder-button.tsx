"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import type {
  BookmarkFolder,
  BookmarkFolderKind,
} from "@/api/hooks/use-bookmark-folders";
import { BookmarkFolderForm } from "@/components/user/bookmark-folder-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogCloseButton,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";

export function CreateBookmarkFolderButton({
  onCreated,
  kind = "threads",
}: {
  onCreated?: (folder: BookmarkFolder) => void;
  kind?: BookmarkFolderKind;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const folderLabel = kind === "moments" ? "动态收藏夹" : "主题帖收藏夹";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="compact"
        onClick={() => setDialogOpen(true)}
      >
        <Plus />
        新建{folderLabel}
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
                <DialogTitle>新建{folderLabel}</DialogTitle>
                <DialogCloseButton type="button" label={`关闭新建${folderLabel}`} />
              </div>

              <div className="mt-5">
                <BookmarkFolderForm
                  autoFocus
                  kind={kind}
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
