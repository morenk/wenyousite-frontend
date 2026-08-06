/** 主题帖创建/编辑表单 — 简洁模式：基础信息 + 默认子贴正文 */

"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Send, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { ThreadMetadataFields } from "@/components/forms/thread-metadata-fields";
import {
  threadCreateSchema,
  type ThreadCreateFormData,
  validatePublishable,
} from "@/lib/validations/thread-create";
import { useSaveThreadAggregate } from "@/api/hooks/use-save-thread-aggregate";
import { useUploadImage } from "@/api/hooks/use-upload-image";
import { API_ERROR_CODE, getApiError } from "@/api/errors";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";

interface ThreadCreateFormProps {
  thread: ThreadDetail;
  /** 新建草稿时为放弃并删除；继续编辑已有草稿时为返回列表 */
  cancelMode?: "discard" | "back";
  onCancel: () => void;
  onPublished: (threadId: string) => void;
}

export function ThreadCreateForm({
  thread,
  cancelMode = "discard",
  onCancel,
  onPublished,
}: ThreadCreateFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const saveThread = useSaveThreadAggregate();
  const uploadImage = useUploadImage();
  const CancelIcon = cancelMode === "back" ? ArrowLeft : Trash2;
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

  async function handleSaveDraft(values: ThreadCreateFormData) {
    const title = values.title?.trim();

    try {
      setIsSaving(true);
      await saveThread.mutateAsync({
        threadId: thread.id,
        body: {
          ...(title ? { title } : {}),
          category: values.category,
          visibility: values.visibility,
          version: thread.version,
          defaultSubthreadVersion: thread.defaultSubthread.version,
          bodyVersion: thread.defaultSubthread.bodyPost?.version,
          content: values.content?.trim() ?? "",
          tagNames: values.tagNames ?? [],
        },
      });
      toast.success("草稿已保存");
    } catch (error: unknown) {
      handleError(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish(values: ThreadCreateFormData) {
    const validationError = validatePublishable(values);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setIsPublishing(true);

      const savedThread = await saveThread.mutateAsync({
        threadId: thread.id,
        body: {
          title: values.title?.trim(),
          category: values.category,
          visibility: values.visibility,
          published: true,
          version: thread.version,
          defaultSubthreadVersion: thread.defaultSubthread.version,
          bodyVersion: thread.defaultSubthread.bodyPost?.version,
          content: values.content?.trim() ?? "",
          tagNames: values.tagNames ?? [],
        },
      });

      toast.success("发布成功");
      onPublished(savedThread.id);
    } catch (error: unknown) {
      handleError(error);
    } finally {
      setIsPublishing(false);
    }
  }

  function handleError(error: unknown) {
    const err = getApiError(error);
    if (err.code === API_ERROR_CODE.BAD_REQUEST) {
      toast.error(err.message || "发布失败，请检查内容");
    } else if (err.code === API_ERROR_CODE.OPTIMISTIC_LOCK_CONFLICT) {
      toast.error("内容已被修改，请刷新后重试");
    } else if (err.code === API_ERROR_CODE.RATE_LIMITED) {
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
        <ThreadMetadataFields
          form={form}
          disabled={isSaving || isPublishing}
        />

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="content">正文</Label>
          <Controller
            control={form.control}
            name="content"
            render={({ field }) => (
              <MilkdownEditor
                threadId={thread.id}
                defaultValue={field.value ?? ""}
                onChange={field.onChange}
                onUploadImage={handleUploadImage}
                disabled={isSaving || isPublishing}
                diceRolls={thread.defaultSubthread.bodyPost?.diceRolls}
              />
            )}
          />
          {form.formState.errors.content?.message && (
            <p className="text-sm text-destructive">
              {form.formState.errors.content.message}
            </p>
          )}
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
          <CancelIcon className="mr-1.5 h-4 w-4" />
          {cancelMode === "back" ? "返回草稿列表" : "放弃"}
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={form.handleSubmit(handleSaveDraft)}
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
            onClick={form.handleSubmit(handlePublish)}
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
