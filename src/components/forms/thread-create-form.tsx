/** 主题帖创建/编辑表单 — 多子贴管理 + 任意楼层编辑（单例编辑器上下文切换） */

"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { TagInput } from "@/components/forms/tag-input";
import { SubthreadList } from "@/components/thread/subthread-list";
import { SubthreadFloors } from "@/components/thread/subthread-floors";
import type { SubthreadFormData } from "@/components/forms/subthread-form";
import {
  threadCreateSchema,
  type ThreadCreateFormData,
  validatePublishable,
} from "@/lib/validations/thread-create";
import { useUpdateThread } from "@/api/hooks/use-update-thread";
import { useCreatePost } from "@/api/hooks/use-create-post";
import { useUpdatePost } from "@/api/hooks/use-update-post";
import { useCreateSubthread } from "@/api/hooks/use-create-subthread";
import { useUpdateSubthread } from "@/api/hooks/use-update-subthread";
import { useDeleteSubthread } from "@/api/hooks/use-delete-subthread";
import { useDeletePost } from "@/api/hooks/use-delete-post";
import { useUploadImage } from "@/api/hooks/use-upload-image";
import type { PostData } from "@/api/hooks/use-floors";
import type { ThreadDetail, SubthreadDetail } from "@/api/hooks/use-thread-detail";

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

interface EditingTarget {
  subthreadId: string;
  /** 有值 = 编辑既有楼层；无值 = 创建新楼层 */
  postId?: string;
  version?: number;
}

export function ThreadCreateForm({
  thread,
  onCancel,
  onPublished,
  onRefetch,
}: ThreadCreateFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const defaultBodyPost = thread.defaultSubthread.bodyPost;
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>({
    subthreadId: thread.defaultSubthreadId,
    postId: defaultBodyPost?.id,
    version: defaultBodyPost?.version,
  });

  const queryClient = useQueryClient();
  const updateThread = useUpdateThread();
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const createSubthread = useCreateSubthread();
  const updateSubthread = useUpdateSubthread();
  const deleteSubthread = useDeleteSubthread();
  const deletePost = useDeletePost();
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

  async function saveEditingContent(target: EditingTarget, content: string) {
    if (!content.trim()) return;
    if (target.postId) {
      await updatePost.mutateAsync({
        postId: target.postId,
        content,
        version: target.version ?? 1,
      });
    } else {
      await createPost.mutateAsync({
        subthreadId: target.subthreadId,
        content,
      });
    }
  }

  function startEditFloor(floor: PostData) {
    setEditingTarget({
      subthreadId: floor.subthreadId,
      postId: floor.id,
      version: floor.version,
    });
    form.setValue("content", floor.content);
  }

  function startAddFloor(subthreadId: string) {
    setEditingTarget({ subthreadId });
    form.setValue("content", "");
  }

  function cancelEditing() {
    setEditingTarget(null);
  }

  function getDefaultSubthreadContent(): string {
    if (editingTarget?.subthreadId === thread.defaultSubthreadId) {
      return form.getValues("content") ?? "";
    }
    return thread.defaultSubthread.bodyPost?.content ?? "";
  }

  async function handleSaveFloor() {
    const content = form.getValues("content")?.trim() ?? "";
    if (!content) {
      toast.error("请输入楼层内容");
      return;
    }
    const target = editingTarget;
    if (!target) return;
    const wasUpdate = !!target.postId;

    try {
      setIsSaving(true);
      await saveEditingContent(target, content);
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      await onRefetch();
      setEditingTarget(null);
      toast.success(wasUpdate ? "楼层已更新" : "楼层已添加");
    } catch (error) {
      handleError(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteFloor(floor: PostData) {
    if (!confirm("确定要删除该楼层吗？")) return;

    try {
      setIsSaving(true);
      await deletePost.mutateAsync(floor.id);
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      await onRefetch();
      toast.success("楼层已删除");
    } catch (error) {
      handleError(error);
    } finally {
      setIsSaving(false);
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
      if (editingTarget) {
        await saveEditingContent(editingTarget, values.content ?? "");
      }
      queryClient.invalidateQueries({ queryKey: ["floors"] });
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
    const defaultContent = getDefaultSubthreadContent();
    const validationError = validatePublishable(values, defaultContent);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setIsPublishing(true);

      if (editingTarget) {
        await saveEditingContent(editingTarget, values.content ?? "");
      }
      queryClient.invalidateQueries({ queryKey: ["floors"] });

      const refetchResult = await onRefetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latestThread = (refetchResult as any)?.data as ThreadDetail | undefined;
      if (!latestThread) {
        toast.error("获取草稿信息失败，请重试");
        return;
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

  async function handleCreateSubthread(data: SubthreadFormData) {
    try {
      await createSubthread.mutateAsync({
        threadId: thread.id,
        body: {
          title: data.title,
          postingPolicy: data.postingPolicy,
        },
      });
      await onRefetch();
      toast.success("子贴已创建");
    } catch {
      toast.error("创建子贴失败");
    }
  }

  async function handleUpdateSubthread(
    subthreadId: string,
    data: SubthreadFormData,
  ) {
    try {
    const sub = thread.subthreads.find(
      (s: SubthreadDetail) => s.id === subthreadId,
    );
      if (!sub) return;
      await updateSubthread.mutateAsync({
        subthreadId,
        body: {
          title: data.title,
          postingPolicy: data.postingPolicy,
          version: sub.version,
        },
      });
      await onRefetch();
      toast.success("子贴已更新");
    } catch {
      toast.error("更新子贴失败");
    }
  }

  async function handleDeleteSubthread(subthreadId: string) {
    try {
      await deleteSubthread.mutateAsync(subthreadId);
      await onRefetch();
      toast.success("子贴已删除");
    } catch {
      toast.error("删除子贴失败");
    }
  }

  function renderFloors(subthread: SubthreadDetail) {
    if (editingTarget?.subthreadId === subthread.id) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            正在编辑：{subthread.title}
            {editingTarget.postId ? "" : " 的新楼层"}
          </p>
          <MilkdownEditor
            key={`${editingTarget.subthreadId}-${editingTarget.postId ?? "new"}`}
            defaultValue={form.getValues("content")}
            onChange={(v) => form.setValue("content", v)}
            onUploadImage={handleUploadImage}
            disabled={isSaving || isPublishing}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelEditing}
              disabled={isSaving || isPublishing}
            >
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveFloor}
              disabled={isSaving || isPublishing}
            >
              {isSaving && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {editingTarget.postId ? "保存修改" : "添加楼层"}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <SubthreadFloors
        subthreadId={subthread.id}
        canManage
        onEditFloor={startEditFloor}
        onDeleteFloor={handleDeleteFloor}
        onAddFloor={() => startAddFloor(subthread.id)}
      />
    );
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
          <Label>子贴管理</Label>
          <SubthreadList
            subthreads={thread.subthreads}
            defaultSubthreadId={thread.defaultSubthreadId}
            showActions
            isSubmitting={isSaving || isPublishing}
            onCreate={handleCreateSubthread}
            onUpdate={handleUpdateSubthread}
            onDelete={handleDeleteSubthread}
            renderFloors={renderFloors}
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
