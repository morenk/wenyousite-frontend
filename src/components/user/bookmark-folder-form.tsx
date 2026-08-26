"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/api/errors";
import {
  useCreateBookmarkFolder,
  type BookmarkFolder,
  type BookmarkFolderKind,
} from "@/api/hooks/use-bookmark-folders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const folderSchema = z.object({
  name: z.string().trim().min(1, "请输入收藏夹名称").max(24, "名称最多 24 个字符"),
});

type FolderFormValues = z.infer<typeof folderSchema>;

export function BookmarkFolderForm({
  onCreated,
  onCancel,
  autoFocus = false,
  kind = "threads",
}: {
  onCreated: (folder: BookmarkFolder) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  kind?: BookmarkFolderKind;
}) {
  const createFolder = useCreateBookmarkFolder(kind);
  const form = useForm<FolderFormValues>({
    resolver: zodResolver(folderSchema),
    defaultValues: { name: "" },
  });

  return (
    <form
      className="space-y-3"
      onSubmit={form.handleSubmit(async ({ name }) => {
        try {
          const folder = await createFolder.mutateAsync(name.trim());
          toast.success(`已新建“${folder.name}”`);
          form.reset();
          onCreated(folder);
        } catch (error) {
          toast.error(getApiErrorMessage(error, "新建收藏夹失败"));
        }
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="bookmark-folder-name">收藏夹名称</Label>
        <Input
          id="bookmark-folder-name"
          autoFocus={autoFocus}
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
      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="compact"
            disabled={createFolder.isPending}
            onClick={onCancel}
          >
            取消
          </Button>
        ) : null}
        <Button type="submit" size="compact" disabled={createFolder.isPending}>
          {createFolder.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          新建
        </Button>
      </div>
    </form>
  );
}
