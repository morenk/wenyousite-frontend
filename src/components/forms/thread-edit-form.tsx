/** 已发布主题帖桌面设置表单：内容主栏 + 发布侧栏 + 楼主专属操作。 */

"use client";

import { useMarkdownWriteCapability } from "@/api/hooks/use-markdown-write-capability";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  ClipboardCopy,
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
import { PrivateInviteLink } from "@/components/forms/private-invite-link";
import { useDeleteThread } from "@/api/hooks/use-delete-thread";
import { API_ERROR_CODE, getApiError, getApiErrorMessage } from "@/api/errors";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import type { ManagementEditorStatus } from "@/components/thread/management-types";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useThreadIdentitySubmission } from "@/components/thread/use-thread-identity-submission";
import { ThreadPublicationIdentity } from "@/components/thread/thread-publication-identity";
import { useInitialBodyWrite } from "@/components/thread/use-initial-body-write";
import { ThreadIdentitySettings } from "@/components/thread/thread-identity-settings";
import { usePublicInviteConfirmation } from "@/components/shared/use-public-invite-confirmation";

interface ThreadEditFormProps {
  thread: ThreadDetail;
  isOwner: boolean;
  formId: string;
  onStatusChange: (status: ManagementEditorStatus) => void;
  onSyncErrorChange?: (hasError: boolean) => void;
  onReloadLatest: () => Promise<ThreadDetail | undefined>;
}

interface ThreadEditBaseline {
  title: string;
  category: string | undefined;
  visibility: ThreadDetail["visibility"];
  status: ThreadDetail["status"];
  tagNames: string[];
  content: string;
  postingPolicy: ThreadDetail["defaultSubthread"]["postingPolicy"];
  version: number;
  defaultSubthreadVersion: number;
  bodyVersion?: number;
}

function getThreadEditBaseline(thread: ThreadDetail): ThreadEditBaseline {
  return {
    title: thread.title,
    category: thread.category ?? undefined,
    visibility: thread.visibility,
    status: thread.status,
    tagNames: thread.topicTags.map((item) => item.tag.name),
    content: thread.defaultSubthread.bodyPost?.content ?? "",
    postingPolicy: thread.defaultSubthread.postingPolicy,
    version: thread.version,
    defaultSubthreadVersion: thread.defaultSubthread.version,
    bodyVersion: thread.defaultSubthread.bodyPost?.version,
  };
}

export function ThreadEditForm({
  thread,
  isOwner,
  formId,
  onStatusChange,
  onSyncErrorChange,
  onReloadLatest,
}: ThreadEditFormProps) {
  const editor = useEditorSubmission();
  const router = useRouter();
  const confirmAction = useConfirm();
  const { confirmPublicInvite, resetPublicInviteConfirmation } = usePublicInviteConfirmation();
  const [syncError, setSyncError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [postingPolicy, setPostingPolicy] = useState(thread.defaultSubthread.postingPolicy);
  const [status, setStatus] = useState<ThreadDetail["status"]>(thread.status);
  const [saveState, setSaveState] = useState<ManagementEditorStatus["state"]>("saved");
  const [saveMessage, setSaveMessage] = useState<string>();
  const saveThread = useSaveThreadAggregate();
  const snapshotMarkdownCapability = useMarkdownWriteCapability();
  const initialBody = useInitialBodyWrite<Parameters<typeof saveThread.mutateAsync>[0]>();
  const { canClose: canCloseInitialBody } = initialBody;
  const uploadImage = useUploadImage();
  const deleteThread = useDeleteThread();
  const [editorContent, setEditorContent] = useState(
    thread.defaultSubthread.bodyPost?.content ?? "",
  );
  const [baseline, setBaseline] = useState<ThreadEditBaseline>(() =>
    getThreadEditBaseline(thread),
  );

  const bodyIdentity = useThreadIdentitySubmission(thread.id, thread.rpIdentityEnabled !== undefined, baseline.bodyVersion === undefined, thread.id);

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
  const editLocked = isBusy || Boolean(initialBody.pendingRequest);
  const isDirty = editor.invalid || editor.hasPendingChanges ||
    title !== baseline.title ||
    category !== baseline.category ||
    status !== baseline.status ||
    postingPolicy !== baseline.postingPolicy ||
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

  const canCloseEditor = editor.canClose;
  useEffect(() => {
    onStatusChange({ ...reportedStatus, canClose: () => canCloseInitialBody() && canCloseEditor(),
      hasChanges: () => {
        const values = form.getValues();
        return values.title !== baseline.title || values.category !== baseline.category
          || status !== baseline.status || postingPolicy !== baseline.postingPolicy
          || (isOwner && values.visibility !== baseline.visibility)
          || JSON.stringify(values.tagNames ?? []) !== JSON.stringify(baseline.tagNames)
          || editor.editorRef.current?.flush() !== baseline.content;
      },
      getDocumentVersion: editor.getDocumentVersion,
    });
  }, [canCloseInitialBody, canCloseEditor, editor.editorRef, editor.getDocumentVersion, onStatusChange, reportedStatus, form, status, postingPolicy, isOwner, baseline]);

  function resetFromThread(nextThread: ThreadDetail) {
    const nextBaseline = getThreadEditBaseline(nextThread);
    form.reset(nextBaseline);
    setStatus(nextBaseline.status);
    setPostingPolicy(nextBaseline.postingPolicy);
    editor.onSynchronized();
    setEditorContent(nextBaseline.content);
    setBaseline(nextBaseline);
    setSaveState("saved");
    setSaveMessage(undefined);
  }

  async function handleSave(values: ThreadCreateFormData) {
    const content = initialBody.pendingRequest?.body.content ?? editor.flush();
    if (content === null) return;
    if (syncError && !initialBody.pendingRequest) return;
    const nextVisibility = isOwner ? values.visibility : thread.visibility;
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      if (!initialBody.pendingRequest && !(await confirmPublicInvite(content, nextVisibility === "PUBLIC"))) return;
      const publicationIdentity = !initialBody.pendingRequest && baseline.bodyVersion === undefined ? await bodyIdentity.prepare() : undefined;
      if (publicationIdentity === null || (!initialBody.pendingRequest && !editor.isCurrent(content))) return;
      setIsSaving(true);
      setSaveState("saving");
      setSaveMessage(undefined);
      const request = initialBody.pendingRequest ?? {
        threadId: thread.id,
        body: {
          title: values.title?.trim(),
          ...(values.category && values.category !== baseline.category
            ? { category: values.category }
            : {}),
          status,
          ...(isOwner ? { visibility: values.visibility } : {}),
          version: baseline.version,
          defaultSubthreadVersion: baseline.defaultSubthreadVersion,
          bodyVersion: baseline.bodyVersion,
          ...publicationIdentity,
          ...(postingPolicy !== baseline.postingPolicy
            ? { defaultSubthreadPostingPolicy: postingPolicy }
            : {}),
          content,
          tagNames: values.tagNames ?? [],
          ...snapshotMarkdownCapability(),
        },
      };
      if (baseline.bodyVersion === undefined) initialBody.freeze(request);
      const savedThread = await saveThread.mutateAsync(request);
      initialBody.finish();
      resetPublicInviteConfirmation();
      resetFromThread(savedThread);
      toast.success("帖子修改已保存");
    } catch (error: unknown) {
      initialBody.fail(error);
      const apiError = getApiError(error);
      if (apiError.code === API_ERROR_CODE.RP_IDENTITY_CHANGED) bodyIdentity.requireConfirmation();
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
      savingRef.current = false;
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
    if (!canCloseInitialBody() || !editor.canClose()) return;
    const revision = editor.getDocumentVersion();
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
    if (!editor.canClose() || revision !== editor.getDocumentVersion()) { toast.error("正文已变化，请再次确认载入"); return; }
    resetFromThread(latest);
    toast.success("已载入最新版本");
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
    visibility === "PRIVATE" && (baseline.visibility !== "PRIVATE" || thread.visibility !== "PRIVATE");

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        if (savingRef.current) {
          event.preventDefault();
          return;
        }
        if (initialBody.pendingRequest) { event.preventDefault(); void handleSave(form.getValues()); return; }
        const content = editor.flush();
        if (content === null) { event.preventDefault(); return; }
        form.setValue("content", content, { shouldDirty: true });
        void form.handleSubmit(handleSave)(event);
      }}
      className="space-y-6"
    >
      {initialBody.uncertain ? <p role="status" className="text-sm text-warning">正文发表结果尚未确认，正文与身份已冻结。请再次保存确认结果，确认前不能修改身份、正文或退出。</p> : null}
      {reportedStatus.state === "conflict" || reportedStatus.state === "error" ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-5 rounded-[var(--radius-panel)] border border-warning/35 bg-warning-soft/45 px-4 py-3"
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
          <div className="space-y-5 rounded-[var(--radius-panel)] border border-border bg-card p-5">
            <ThreadMetadataFields
              form={form}
              disabled={editLocked}
              sections="identity"
            />

            <div className="space-y-2">
              <Label htmlFor="content">主帖正文</Label>
              {baseline.bodyVersion === undefined && thread.rpIdentityEnabled !== undefined ? <ThreadPublicationIdentity controller={bodyIdentity} threadId={thread.id} disabled={editLocked} /> : null}
              <Controller
                control={form.control}
                name="content"
                render={({ field }) => (
                  <MilkdownEditor mentionIdentities={thread.defaultSubthread.bodyPost?.mentionIdentities} mediaDisplays={thread.defaultSubthread.bodyPost?.mediaDisplays}
                    editorRef={editor.editorRef}
                    onValidityChange={editor.onValidityChange}
                    onDocumentChange={editor.onDocumentChange}
                    onSyncErrorChange={(hasError) => { setSyncError(hasError); onSyncErrorChange?.(hasError); }}
                    threadId={thread.id}
                    defaultValue={field.value ?? ""}
                    onChange={(value) => {
                      editor.onSynchronized();
                      setEditorContent(value);
                      field.onChange(value);
                    }}
                    onUploadImage={(file, options) => uploadImage.mutateAsync(file, options)}
                    disabled={editLocked}
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
          {isOwner && thread.rpIdentityEnabled !== undefined ? <ThreadIdentitySettings threadId={thread.id} enabled={thread.rpIdentityEnabled} disabled={editLocked} /> : null}
          <section className="rounded-[var(--radius-panel)] border border-border bg-muted/25 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-sans text-lg font-semibold text-foreground">发布设置</h2>
            </div>
            <div className="space-y-4">
              <ThreadMetadataFields
                form={form}
                disabled={editLocked}
                sections="publication"
                showVisibility
                visibilityReadOnly={!isOwner}
                currentCategoryInfo={thread.categoryInfo}
                postingPolicy={postingPolicy}
                onPostingPolicyChange={setPostingPolicy}
                status={status}
                onStatusChange={(nextStatus) => {
                  setStatus(nextStatus);
                }}
              />
            </div>
          </section>

          {isOwner && visibility === "PRIVATE" && thread.visibility === "PRIVATE" && !thread.deletedAt ? (
            <PrivateInviteLink
              threadId={thread.id}
              ownerId={thread.ownerId}
              disabled={editLocked || deleteThread.isPending}
              unavailableReason={!thread.published ? "请先发布帖子。" : inviteNeedsVisibilitySave ? "请先保存可见性设置。" : undefined}
            />
          ) : null}
        </aside>
      </div>

      {isOwner ? (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="destructive"
            disabled={editLocked || deleteThread.isPending}
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
