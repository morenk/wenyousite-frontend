/** 主题帖创建/编辑表单 — 简洁模式：基础信息 + 默认子贴正文 */

"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Send, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { TagInput } from "@/components/forms/tag-input";
import {
  threadCreateSchema,
  type ThreadCreateFormData,
  validatePublishable,
} from "@/lib/validations/thread-create";
import { useUpdateThread } from "@/api/hooks/use-update-thread";
import { useCreatePost } from "@/api/hooks/use-create-post";
import { useUpdatePost } from "@/api/hooks/use-update-post";
import { useUploadImage } from "@/api/hooks/use-upload-image";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";

interface ThreadCreateFormProps {
  thread: ThreadDetail;
  onCancel: () => void;
  onPublished: (threadId: string) => void;
  onRefetch: () => Promise<unknown>;
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

export function ThreadCreateForm({
  thread,
  onCancel,
  onPublished,
  onRefetch,
}: ThreadCreateFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const updateThread = useUpdateThread();
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const uploadImage = useUploadImage();

  const form = useForm<ThreadCreateFormData>({
    resolver: zodResolver(threadCreateSchema),
    defaultValues: {
      title: thread.title === "未命名草稿" ? "" : thread.title,
      category: thread.category,
      visibility: thread.visibility,
      tagNames: thread.topicTags.map((t) => t.tag.name),
      subthreadTitle: thread.defaultSubthread.title,
      content: thread.defaultSubthread.bodyPost?.content ?? "",
    },
  });

  const category = useWatch({ control: form.control, name: "category" });
  const visibility = useWatch({ control: form.control, name: "visibility" });
  const tagNames = useWatch({ control: form.control, name: "tagNames" });

  async function saveBodyContent(values: ThreadCreateFormData) {
    const content = values.content?.trim() ?? "";
    const bodyPost = thread.defaultSubthread.bodyPost;

    if (content) {
      if (bodyPost) {
        await updatePost.mutateAsync({
          postId: bodyPost.id,
          content,
          version: bodyPost.version,
        });
      } else {
        await createPost.mutateAsync({
          subthreadId: thread.defaultSubthreadId,
          content,
        });
      }
    }
  }

  async function handleSaveDraft() {
    const values = form.getValues();
    const body: ThreadCreateFormData & { version: number } = {
      ...values,
      version: thread.version,
    };
    if (!body.title || body.title.trim() === "") {
      delete body.title;
    }

    try {
      setIsSaving(true);
      await updateThread.mutateAsync({
        threadId: thread.id,
        body,
      });
      await saveBodyContent(values);
      await onRefetch();
      toast.success("草稿已保存");
    } catch (error: unknown) {
      handleError(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    const values = form.getValues();
    const validationError = validatePublishable(values);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setIsPublishing(true);

      const refetchResult = await onRefetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latestThread = (refetchResult as any)?.data as ThreadDetail | undefined;
      if (!latestThread) {
        toast.error("获取草稿信息失败，请重试");
        return;
      }

      const content = values.content?.trim() ?? "";
      if (content && !latestThread.defaultSubthread.bodyPost) {
        await createPost.mutateAsync({
          subthreadId: latestThread.defaultSubthreadId,
          content,
        });
      } else if (content && latestThread.defaultSubthread.bodyPost) {
        await updatePost.mutateAsync({
          postId: latestThread.defaultSubthread.bodyPost.id,
          content,
          version: latestThread.defaultSubthread.bodyPost.version,
        });
      }

      await updateThread.mutateAsync({
        threadId: latestThread.id,
        body: {
          title: values.title,
          category: values.category,
          visibility: values.visibility,
          published: true,
          version: latestThread.version,
        },
      });

      toast.success("发布成功");
      onPublished(latestThread.id);
    } catch (error: unknown) {
      handleError(error);
    } finally {
      setIsPublishing(false);
    }
  }

  function handleError(error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err.code === 40001) {
      toast.error(err.message || "发布失败，请检查内容");
    } else if (err.code === 40900) {
      toast.error("内容已被修改，请刷新后重试");
    } else if (err.code === 42900) {
      toast.error("操作太频繁，请稍后再试");
    } else {
      toast.error(err.message || "操作失败，请稍后重试");
    }
  }

  async function handleUploadImage(file: File) {
    const url = await uploadImage.mutateAsync(file);
    return url;
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
            disabled={isSaving || isPublishing}
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
            disabled={isSaving || isPublishing}
            className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tags">标签</Label>
          <TagInput
            value={tagNames ?? []}
            onChange={(tags) => form.setValue("tagNames", tags)}
            disabled={isSaving || isPublishing}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="content">正文</Label>
          <MilkdownEditor
            defaultValue={form.getValues("content") ?? ""}
            onChange={(v) => form.setValue("content", v)}
            onUploadImage={handleUploadImage}
            disabled={isSaving || isPublishing}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving || isPublishing}
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          放弃
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSaving || isPublishing}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            保存草稿
          </Button>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={isSaving || isPublishing}
          >
            {isPublishing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            发布
          </Button>
        </div>
      </div>
    </div>
  );
}
