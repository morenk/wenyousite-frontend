"use client";

import { useRef, useState, type RefObject } from "react";
import { Menu } from "@base-ui/react/menu";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { getApiError, getApiErrorMessage } from "@/api/errors";
import { useDeleteBookmarkFolder, useRenameBookmarkFolder, type BookmarkFolder, type BookmarkFolderKind } from "@/api/hooks/use-bookmark-folders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { Dialog, DialogBackdrop, DialogDescription, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";

const schema = z.object({ name: z.string().trim().min(1, "请输入收藏夹名称").refine((name) => Array.from(name).length <= 24, "名称最多 24 个字符") });

export function BookmarkFolderManagement({ folder, kind, viewerScope, onRenamed, onDeleted, headingRef }: {
  folder: BookmarkFolder;
  kind: BookmarkFolderKind;
  viewerScope: string;
  onRenamed: () => void;
  onDeleted: (destinationFolderId: string) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const [action, setAction] = useState<"rename" | "delete" | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const rename = useRenameBookmarkFolder(kind, viewerScope);
  const remove = useDeleteBookmarkFolder(kind, viewerScope);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: folder.name } });
  const [deleteError, setDeleteError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const pending = submitting || rename.isPending || remove.isPending;
  const registration = form.register("name");

  function open(next: "rename" | "delete") {
    form.reset({ name: folder.name });
    setDeleteError(undefined);
    setAction(next);
  }

  if (folder.isDefault) return null;
  return <>
    <Menu.Root>
      <Menu.Trigger render={<Button ref={triggerRef} variant="ghost" size="icon-compact" aria-label={`更多收藏夹操作：${folder.name}`} disabled={pending} />}>
        <WenyouIcon id="action.more" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={4} className="z-[var(--layer-popup)]">
          <Menu.Popup finalFocus={action ? false : triggerRef} className="w-40 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-popover outline-none">
            <Menu.Item onClick={() => open("rename")} className="flex min-h-10 cursor-pointer items-center rounded-lg px-3 text-sm outline-none data-highlighted:bg-muted">重命名</Menu.Item>
            <Menu.Item onClick={() => open("delete")} className="flex min-h-10 cursor-pointer items-center rounded-lg px-3 text-sm text-destructive outline-none data-highlighted:bg-muted">删除收藏夹</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
    <Dialog open={action !== null} onOpenChange={(value) => { if (!value && !pending) setAction(null); }}>
      <DialogPortal><DialogBackdrop /><DialogViewport>
        <DialogPopup className="max-w-sm p-6" finalFocus={() => triggerRef.current ?? headingRef.current}
          initialFocus={() => {
            if (action === "rename") { inputRef.current?.focus(); inputRef.current?.select(); return false; }
            return cancelRef.current;
          }}>
          <DialogTitle>{action === "rename" ? "重命名收藏夹" : "删除收藏夹"}</DialogTitle>
          {action === "rename" ? <form className="mt-5 space-y-4" aria-busy={pending} onSubmit={form.handleSubmit(async ({ name }) => {
            if (pending) return;
            setSubmitting(true);
            try {
              await rename.mutateAsync({ id: folder.id, name });
              onRenamed();
              setAction(null);
            } catch (error) {
              const info = getApiError(error);
              form.setError(info.code === 40001 || info.code === 40900 || info.status === 400 || info.status === 409 ? "name" : "root", {
                message: getApiErrorMessage(error, "重命名失败，请重试"),
              });
            } finally { setSubmitting(false); }
          })}>
            <div className="space-y-2">
              <Label htmlFor="rename-bookmark-folder">收藏夹名称</Label>
              <Input id="rename-bookmark-folder" {...registration} ref={(node) => { registration.ref(node); inputRef.current = node; }} disabled={pending}
                aria-invalid={!!form.formState.errors.name} aria-describedby={form.formState.errors.name ? "rename-folder-error" : undefined} />
              {form.formState.errors.name ? <p id="rename-folder-error" role="alert" className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
              {form.formState.errors.root ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="compact" disabled={pending} onClick={() => setAction(null)}>取消</Button>
              <Button type="submit" size="compact" pending={pending} pendingLabel="保存中">保存</Button>
            </div>
          </form> : <div className="mt-4 space-y-4" aria-busy={pending}>
            <p className="break-words text-sm">删除“{folder.name}”？</p>
            <DialogDescription>收藏夹内的收藏会移到默认收藏夹，收藏内容不会删除。</DialogDescription>
            {deleteError ? <p role="alert" className="text-sm text-destructive">{deleteError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button ref={cancelRef} type="button" variant="ghost" size="compact" disabled={pending} onClick={() => setAction(null)}>取消</Button>
              <Button type="button" variant="destructive" size="compact" pending={pending} pendingLabel="删除中" onClick={async () => {
                if (pending) return;
                setSubmitting(true);
                setDeleteError(undefined);
                try {
                  const result = await remove.mutateAsync(folder.id);
                  onDeleted(result.destinationFolderId);
                  toast.success("收藏夹已删除，收藏已移到默认收藏夹");
                  setAction(null);
                } catch (error) { setDeleteError(getApiErrorMessage(error, "删除收藏夹失败，请重试")); }
                finally { setSubmitting(false); }
              }}>删除收藏夹</Button>
            </div>
          </div>}
        </DialogPopup>
      </DialogViewport></DialogPortal>
    </Dialog>
  </>;
}
