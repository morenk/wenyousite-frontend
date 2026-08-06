/** 已发布主题帖编辑表单：标题/分区/可见性/标签/正文 + 保存修改 */

"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

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
  onSaved: () => Promise<unknown>;
  onDirtyChange?: (isDirty: boolean) => void;
  onSavingChange?: (isSaving: boolean) => void;
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
  { value: "CLOSED", label: "已停招" },
  { value: "FINISHED", label: "已结束" },
];

interface ThreadEditBaseline {
  title: string;
  category: ThreadDetail["category"];
  visibility: ThreadDetail["visibility"];
  status: ThreadDetail["status"];
  tagNames: string[];
  content: string;
}

function getThreadEditBaseline(thread: ThreadDetail): ThreadEditBaseline {
  return {
    title: thread.title,
    category: thread.category,
    visibility: thread.visibility,
    status: thread.status,
    tagNames: thread.topicTags.map((item) => item.tag.name),
    content: thread.defaultSubthread.bodyPost?.content ?? "",
  };
}

export function ThreadEditForm({
  thread,
  isOwner,
  onSaved,
  onDirtyChange,
  onSavingChange,
}: ThreadEditFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<ThreadDetail["status"]>(thread.status);

  const updateThread = useUpdateThread();
  const updateSubthread = useUpdateSubthread();
  const upsertBody = useUpsertBody();
  const syncTags = useSyncThreadTags();
  const uploadImage = useUploadImage();
  const [editorContent, setEditorContent] = useState(
    thread.defaultSubthread.bodyPost?.content ?? "",
  );
  const [baseline, setBaseline] = useState<ThreadEditBaseline>(() =>
    getThreadEditBaseline(thread),
  );

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
  const title = useWatch({ control: form.control, name: "title" });
  const isBusy = isSaving || uploadImage.isPending;
  const isDirty =
    title !== baseline.title ||
    category !== baseline.category ||
    status !== baseline.status ||
    (isOwner && visibility !== baseline.visibility) ||
    JSON.stringify(tagNames ?? []) !==
      JSON.stringify(baseline.tagNames) ||
    editorContent !== baseline.content;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onSavingChange?.(isBusy);
  }, [isBusy, onSavingChange]);

  /** 默认子贴标题跟随主题帖标题（与创建表单一致） */
  async function syncDefaultSubthreadTitle(
    values: ThreadCreateFormData,
    latestThread: ThreadDetail,
  ) {
    const title = values.title?.trim();
    const defaultSub = latestThread.defaultSubthread;
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
    const values = { ...form.getValues(), content: editorContent };
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
      await syncDefaultSubthreadTitle(values, latestThread);
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

      const savedResult = await onSaved();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const savedThread = (savedResult as any)?.data as ThreadDetail | undefined;

      const nextBaseline = savedThread
        ? getThreadEditBaseline(savedThread)
        : {
            title: values.title?.trim() ?? "",
            category: values.category,
            visibility: values.visibility,
            status,
            tagNames: values.tagNames ?? [],
            content,
          };
      form.reset(nextBaseline);
      setStatus(nextBaseline.status);
      setEditorContent(nextBaseline.content);
      setBaseline(nextBaseline);

      toast.success("修改已保存");
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
            disabled={isBusy}
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
                { shouldDirty: true },
              )
            }
            disabled={isBusy}
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
            disabled={isBusy}
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
                { shouldDirty: true },
              )
            }
            disabled={isBusy}
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
            onChange={(tags) =>
              form.setValue("tagNames", tags, { shouldDirty: true })
            }
            disabled={isBusy}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="content">主帖正文</Label>
          <Controller
            control={form.control}
            name="content"
            render={({ field }) => (
              <MilkdownEditor
                threadId={thread.id}
                defaultValue={field.value ?? ""}
                onChange={(value) => {
                  setEditorContent(value);
                  field.onChange(value);
                }}
                onUploadImage={async (file) => uploadImage.mutateAsync(file)}
                disabled={isSaving}
                diceRolls={thread.defaultSubthread.bodyPost?.diceRolls}
              />
            )}
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="button" onClick={handleSave} disabled={isBusy}>
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
