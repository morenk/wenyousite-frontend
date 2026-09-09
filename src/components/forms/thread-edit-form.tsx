/** 已发布主题帖桌面设置表单：内容主栏 + 发布侧栏 + 楼主专属操作。 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  ClipboardCopy,
  KeyRound,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEditorSubmission, EDITOR_SYNC_ERROR } from "@/components/editor/use-editor-submission";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { ThreadMetadataFields } from "@/components/forms/thread-metadata-fields";
import {
  threadCreateSchema,
  type ThreadCreateFormData,
} from "@/lib/validations/thread-create";
import { useSaveThreadAggregate } from "@/api/hooks/use-save-thread-aggregate";
import { useUploadImage } from "@/api/hooks/use-upload-image";
import { useCreateInviteLink } from "@/api/hooks/use-thread-access-actions";
import { useDeleteThread } from "@/api/hooks/use-delete-thread";
import { API_ERROR_CODE, getApiError, getApiErrorMessage } from "@/api/errors";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import type { ManagementEditorStatus } from "@/components/thread/management-types";
import { useConfirm } from "@/components/ui/confirm-provider";
import { usePublicInviteConfirmation } from "@/components/shared/use-public-invite-confirmation";

interface ThreadEditFormProps {
  thread: ThreadDetail;
  isOwner: boolean;
  formId: string;
  onStatusChange: (status: ManagementEditorStatus) => void;
  onReloadLatest: () => Promise<ThreadDetail | undefined>;
}

interface ThreadEditBaseline {
  title: string;
  category: string | undefined;
  visibility: ThreadDetail["visibility"];
  status: ThreadDetail["status"];
  tagNames: string[];
  content: string;
}

function getThreadEditBaseline(thread: ThreadDetail): ThreadEditBaseline {
  return {
    title: thread.title,
    category: thread.category ?? undefined,
    visibility: thread.visibility,
    status: thread.status,
    tagNames: thread.topicTags.map((item) => item.tag.name),
    content: thread.defaultSubthread.bodyPost?.content ?? "",
  };
}

export function ThreadEditForm({
  thread,
  isOwner,
  formId,
  onStatusChange,
  onReloadLatest,
}: ThreadEditFormProps) {
  const editor = useEditorSubmission();
  const router = useRouter();
  const confirmAction = useConfirm();
  const { confirmPublicInvite, resetPublicInviteConfirmation } = usePublicInviteConfirmation();
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<ThreadDetail["status"]>(thread.status);
  const [saveState, setSaveState] = useState<ManagementEditorStatus["state"]>("saved");
  const [saveMessage, setSaveMessage] = useState<string>();
  const saveThread = useSaveThreadAggregate();
  const uploadImage = useUploadImage();
  const createInviteLink = useCreateInviteLink();
  const deleteThread = useDeleteThread();
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
      category: thread.category ?? undefined,
      visibility: thread.visibility,
      tagNames: thread.topicTags.map((item) => item.tag.name),
      content: thread.defaultSubthread.bodyPost?.content ?? "",
    },
  });

  const category = useWatch({ control: form.control, name: "category" });
  const visibility = useWatch({ control: form.control, name: "visibility" });
  const tagNames = useWatch({ control: form.control, name: "tagNames" });
  const title = useWatch({ control: form.control, name: "title" });
  const isBusy = isSaving || uploadImage.isPending;
  const isDirty = editor.invalid ||
    title !== baseline.title ||
    category !== baseline.category ||
    status !== baseline.status ||
    (isOwner && visibility !== baseline.visibility) ||
    JSON.stringify(tagNames ?? []) !== JSON.stringify(baseline.tagNames) ||
    editorContent !== baseline.content;

  const reportedStatus = useMemo<ManagementEditorStatus>(() => {
    if (editor.invalid) return { state: "error", dirty: true, busy: false, message: EDITOR_SYNC_ERROR };
    if (isBusy) return { state: "saving", dirty: isDirty, busy: true };
    if (!isDirty) return { state: "saved", dirty: false, busy: false };
    if (saveState === "conflict" || saveState === "error") {
      return { state: saveState, dirty: true, busy: false, message: saveMessage };
    }
    return { state: "dirty", dirty: true, busy: false };
  }, [editor.invalid, isBusy, isDirty, saveMessage, saveState]);

  useEffect(() => {
    onStatusChange({ ...reportedStatus, canClose: editor.canClose });
  }, [editor.canClose, onStatusChange, reportedStatus]);

  function resetFromThread(nextThread: ThreadDetail) {
    const nextBaseline = getThreadEditBaseline(nextThread);
    form.reset(nextBaseline);
    setStatus(nextBaseline.status);
    setEditorContent(nextBaseline.content);
    setBaseline(nextBaseline);
    setSaveState("saved");
    setSaveMessage(undefined);
  }

  async function handleSave(values: ThreadCreateFormData) {
    const content = editor.flush();
    if (content === null) return;
    const nextVisibility = isOwner ? values.visibility : thread.visibility;
    if (!(await confirmPublicInvite(content, nextVisibility === "PUBLIC"))) return;
    if (!editor.isCurrent(content)) return;
    try {
      setIsSaving(true);
      setSaveState("saving");
      setSaveMessage(undefined);
      const savedThread = await saveThread.mutateAsync({
        threadId: thread.id,
        body: {
          title: values.title?.trim(),
          ...(values.category && values.category !== baseline.category
            ? { category: values.category }
            : {}),
          status,
          ...(isOwner ? { visibility: values.visibility } : {}),
          version: thread.version,
          defaultSubthreadVersion: thread.defaultSubthread.version,
          bodyVersion: thread.defaultSubthread.bodyPost?.version,
          content,
          tagNames: values.tagNames ?? [],
        },
      });
      resetPublicInviteConfirmation();
      resetFromThread(savedThread);
      toast.success("帖子修改已保存");
    } catch (error: unknown) {
      const apiError = getApiError(error);
      if (apiError.code === API_ERROR_CODE.OPTIMISTIC_LOCK_CONFLICT) {
        setSaveState("conflict");
        setSaveMessage("内容已被其他管理者修改，本地输入仍然保留。");
        toast.error("内容版本冲突，本地修改仍保留");
      } else {
        const message = apiError.code === API_ERROR_CODE.RATE_LIMITED
          ? "操作太频繁，请稍后再试"
          : apiError.message || "保存失败，请稍后重试";
        setSaveState("error");
        setSaveMessage(message);
        toast.error(message);
      }
    } finally {
      setIsSaving(false);
    }
  }

  const handleCopyLocalContent = async () => {
    try {
      const content = editor.flush();
      if (content === null) return;
      await navigator.clipboard.writeText(content);
      toast.success("本地主帖正文已复制");
    } catch {
      toast.error("复制失败，请手动全选正文保存");
    }
  };

  const handleReloadLatest = async () => {
    if (!(await confirmAction({
      title: "载入最新版本",
      description: "载入后会放弃当前表单的本地修改。建议先复制本地主帖正文。",
      confirmLabel: "载入最新版本",
      destructive: true,
    }))) return;
    const latest = await onReloadLatest();
    if (!latest) {
      toast.error("无法载入最新版本，请稍后重试");
      return;
    }
    resetFromThread(latest);
    toast.success("已载入最新版本");
  };

  const handleCreateInvite = async () => {
    if (!(await confirmAction({
      title: "生成新的邀请链接",
      description: "生成后旧邀请链接会立即失效。确定继续吗？",
      confirmLabel: "生成并复制",
    }))) return;
    try {
      const invite = await createInviteLink.mutateAsync(thread.id);
      await navigator.clipboard.writeText(
        `${window.location.origin}/join/${invite.token}`,
      );
      toast.success("新邀请链接已复制，旧链接已失效");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "邀请链接生成失败"));
    }
  };

  const handleDeleteThread = async () => {
    const childCount = Math.max(0, thread.subthreads.length - 1);
    if (!(await confirmAction({
      title: `删除「${thread.title}」`,
      description: `帖子、${childCount} 个子贴和 ${thread._count.posts} 个楼层将被删除且无法恢复。${isDirty ? "当前未保存修改也会丢失。" : ""}`,
      confirmLabel: "删除主题帖",
      destructive: true,
    }))) return;
    try {
      await deleteThread.mutateAsync(thread.id);
      toast.success("主题帖已删除");
      router.replace("/");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "删除失败，请稍后重试"));
    }
  };

  const inviteNeedsVisibilitySave =
    visibility === "PRIVATE" && thread.visibility !== "PRIVATE";

  return (
    <form
      id={formId}
      onSubmit={form.handleSubmit(handleSave)}
      className="space-y-6"
    >
      {reportedStatus.state === "conflict" || reportedStatus.state === "error" ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-5 rounded-xl border border-warning/35 bg-warning-soft/45 px-4 py-3"
        >
          <div className="flex min-w-0 gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {reportedStatus.state === "conflict" ? "检测到内容版本冲突" : "帖子尚未保存"}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {reportedStatus.message}
              </p>
            </div>
          </div>
          {reportedStatus.state === "conflict" ? (
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="compact" onClick={handleCopyLocalContent}>
                <ClipboardCopy />
                复制本地正文
              </Button>
              <Button type="button" variant="outline" size="compact" onClick={() => void handleReloadLatest()}>
                <RotateCcw />
                载入最新版本
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_18rem] items-start gap-6">
        <section className="min-w-0">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
            <ThreadMetadataFields
              form={form}
              disabled={isBusy}
              sections="identity"
            />

            <div className="space-y-2">
              <Label htmlFor="content">主帖正文</Label>
              <Controller
                control={form.control}
                name="content"
                render={({ field }) => (
                  <MilkdownEditor
                    editorRef={editor.editorRef}
                    onValidityChange={editor.onValidityChange}
                    threadId={thread.id}
                    defaultValue={field.value ?? ""}
                    onChange={(value) => {
                      setEditorContent(value);
                      field.onChange(value);
                    }}
                    onUploadImage={(file, options) => uploadImage.mutateAsync(file, options)}
                    disabled={isSaving}
                    minHeight={420}
                    maxHeight={560}
                    diceRolls={thread.defaultSubthread.bodyPost?.diceRolls}
                    ariaLabel="主帖正文"
                  />
                )}
              />
              {form.formState.errors.content?.message ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.content.message}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="sticky top-4 space-y-4">
          <section className="rounded-2xl border border-border bg-muted/25 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-sans text-lg font-semibold text-foreground">发布设置</h2>
            </div>
            <div className="space-y-4">
              <ThreadMetadataFields
                form={form}
                disabled={isBusy}
                sections="publication"
                showVisibility
                visibilityReadOnly={!isOwner}
                currentCategoryInfo={thread.categoryInfo}
                status={status}
                onStatusChange={(nextStatus) => {
                  setStatus(nextStatus);
                }}
              />
            </div>
          </section>

          {isOwner && visibility === "PRIVATE" ? (
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <KeyRound className="size-4 text-brand-strong" />
                私密访问
              </div>
              <Button
                type="button"
                variant="outline"
                size="compact"
                className="mt-3 w-full"
                disabled={inviteNeedsVisibilitySave || createInviteLink.isPending || isBusy}
                onClick={() => void handleCreateInvite()}
              >
                {createInviteLink.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
                生成并复制邀请链接
              </Button>
              {inviteNeedsVisibilitySave ? (
                <p className="mt-2 text-xs text-warning">请先保存可见性设置。</p>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>

      {isOwner ? (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="destructive"
            disabled={isBusy || deleteThread.isPending}
            onClick={() => void handleDeleteThread()}
          >
            {deleteThread.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            删除主题帖
          </Button>
        </div>
      ) : null}
    </form>
  );
}
