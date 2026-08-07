/** 已发布主题帖编辑表单：标题/分区/可见性/标签/正文 + 保存修改 */

"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { ThreadMetadataFields } from "@/components/forms/thread-metadata-fields";
import {
  threadCreateSchema,
  type ThreadCreateFormData,
} from "@/lib/validations/thread-create";
import { useSaveThreadAggregate } from "@/api/hooks/use-save-thread-aggregate";
import { useUploadImage } from "@/api/hooks/use-upload-image";
import { API_ERROR_CODE, getApiError } from "@/api/errors";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";

interface ThreadEditFormProps {
  thread: ThreadDetail;
  isOwner: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onSavingChange?: (isSaving: boolean) => void;
}

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
  onDirtyChange,
  onSavingChange,
}: ThreadEditFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<ThreadDetail["status"]>(thread.status);

  const saveThread = useSaveThreadAggregate();
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

  async function handleSave(values: ThreadCreateFormData) {
    try {
      setIsSaving(true);
      const content = values.content ?? "";
      const savedThread = await saveThread.mutateAsync({
        threadId: thread.id,
        body: {
          title: values.title?.trim(),
          category: values.category,
          status,
          ...(isOwner ? { visibility: values.visibility } : {}),
          version: thread.version,
          defaultSubthreadVersion: thread.defaultSubthread.version,
          bodyVersion: thread.defaultSubthread.bodyPost?.version,
          content,
          tagNames: values.tagNames ?? [],
        },
      });
      const nextBaseline = getThreadEditBaseline(savedThread);
      form.reset(nextBaseline);
      setStatus(nextBaseline.status);
      setEditorContent(nextBaseline.content);
      setBaseline(nextBaseline);

      toast.success("修改已保存");
    } catch (error: unknown) {
      const err = getApiError(error);
      if (err.code === API_ERROR_CODE.OPTIMISTIC_LOCK_CONFLICT) {
        toast.error("内容已被修改，请刷新后重试");
      } else if (err.code === API_ERROR_CODE.RATE_LIMITED) {
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
        <ThreadMetadataFields
          form={form}
          disabled={isBusy}
          showVisibility={isOwner}
          status={status}
          onStatusChange={setStatus}
        />

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
          {form.formState.errors.content?.message && (
            <p className="text-sm text-destructive">
              {form.formState.errors.content.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <Button
          type="button"
          onClick={form.handleSubmit(handleSave)}
          disabled={isBusy}
        >
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
