/** 已发布主题帖编辑表单：标题/分区/可见性/标签/正文 + 保存修改 */

"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { TagInput } from "@/components/forms/tag-input";
import {
  threadCreateSchema,
  type ThreadCreateFormData,
} from "@/lib/validations/thread-create";
import { useUpdateThread } from "@/api/hooks/use-update-thread";
import { useUpdateSubthread } from "@/api/hooks/use-update-subthread";
import { useUpsertBody } from "@/api/hooks/use-upsert-body";
import { useSyncThreadTags } from "@/api/hooks/use-sync-thread-tags";
import { useUploadImage } from "@/api/hooks/use-upload-image";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";

interface ThreadEditFormProps {
  thread: ThreadDetail;
  isOwner: boolean;
  onBack: () => void;
  onSaved: () => Promise<unknown>;
}

const CATEGORY_OPTIONS = [
  { value: "DEDUCTION", label: "演绎" },
  { value: "NATION", label: "国策" },
  { value: "RPG", label: "角色扮演" },
];

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "公开" },
  { value: "PRIVATE", label: "私密" },
];

const STATUS_OPTIONS = [
  { value: "RECRUITING", label: "招募中" },
  { value: "CLOSED", label: "已关闭" },
  { value: "FINISHED", label: "已完结" },
];

export function ThreadEditForm({
  thread,
  isOwner,
  onBack,
  onSaved,
}: ThreadEditFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<ThreadDetail["status"]>(thread.status);

  const updateThread = useUpdateThread();
  const updateSubthread = useUpdateSubthread();
  const upsertBody = useUpsertBody();
  const syncTags = useSyncThreadTags();
  const uploadImage = useUploadImage();

  const form = useForm<ThreadCreateFormData>({
    resolver: zodResolver(threadCreateSchema),
    defaultValues: {
      title: thread.title,
      category: thread.category,
      visibility: thread.visibility,
      tagNames: thread.topicTags.map((t) => t.tag.name),
      content: thread.defaultSubthread.bodyPost?.content ?? "",
    },
  });

  const category = useWatch({ control: form.control, name: "category" });
  const visibility = useWatch({ control: form.control, name: "visibility" });
  const tagNames = useWatch({ control: form.control, name: "tagNames" });

  /** 默认子贴标题跟随主题帖标题（与创建表单一致） */
  async function syncDefaultSubthreadTitle(values: ThreadCreateFormData) {
    const title = values.title?.trim();
    const defaultSub = thread.defaultSubthread;
    if (!title || defaultSub.title === title) return;
    await updateSubthread.mutateAsync({
      subthreadId: defaultSub.id,
      body: {
        title,
        version: defaultSub.version,
      },
    });
  }

  async function handleSave() {
    const values = form.getValues();
    try {
      setIsSaving(true);

      const refetchResult = await onSaved();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latestThread = (refetchResult as any)?.data as ThreadDetail | undefined;
      if (!latestThread) {
        toast.error("获取帖子信息失败，请重试");
        return;
      }

      const content = values.content?.trim() ?? "";
      if (content || latestThread.defaultSubthread.bodyPost) {
        await upsertBody.mutateAsync({
          subthreadId: latestThread.defaultSubthreadId,
          content,
          version: latestThread.defaultSubthread.bodyPost?.version,
        });
      }
      await syncDefaultSubthreadTitle(values);
      await syncTags.mutateAsync({
        threadId: latestThread.id,
        existingTags: latestThread.topicTags.map((t) => t.tag),
        targetNames: values.tagNames ?? [],
      });

      await updateThread.mutateAsync({
        threadId: latestThread.id,
        body: {
          title: values.title,
          category: values.category,
          status,
          ...(isOwner ? { visibility: values.visibility } : {}),
          version: latestThread.version,
        },
      });

      // 保存成功后刷新详情缓存（返回详情页时读到最新标题等数据）
      await onSaved();

      toast.success("修改已保存");
      onBack();
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 40900) {
        toast.error("内容已被修改，请刷新后重试");
      } else if (err.code === 42900) {
        toast.error("操作太频繁，请稍后再试");
      } else {
        toast.error(err.message || "保存失败，请稍后重试");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">主题帖标题</Label>
          <Input
            id="title"
            placeholder="给你的主题帖起个名字"
            {...form.register("title")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">分区</Label>
          <select
            id="category"
            value={category}
            onChange={(e) =>
              form.setValue(
                "category",
                e.target.value as ThreadCreateFormData["category"],
              )
            }
            disabled={isSaving}
            className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">状态</Label>
          <select
            id="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as ThreadDetail["status"])}
            disabled={isSaving}
            className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {isOwner && <div className="space-y-2">
          <Label htmlFor="visibility">可见性</Label>
          <select
            id="visibility"
            value={visibility}
            onChange={(e) =>
              form.setValue(
                "visibility",
                e.target.value as ThreadCreateFormData["visibility"],
              )
            }
            disabled={isSaving}
            className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>}

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tags">标签</Label>
          <TagInput
            value={tagNames ?? []}
            onChange={(tags) => form.setValue("tagNames", tags)}
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="content">默认子贴正文</Label>
          <MilkdownEditor
            threadId={thread.id}
            defaultValue={form.getValues("content") ?? ""}
            onChange={(v) => form.setValue("content", v)}
            onUploadImage={async (file) => uploadImage.mutateAsync(file)}
            disabled={isSaving}
            diceRolls={thread.defaultSubthread.bodyPost?.diceRolls}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={isSaving}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          返回
        </Button>
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          保存修改
        </Button>
      </div>
    </div>
  );
}
