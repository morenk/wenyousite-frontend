/** 主题帖详情统一编辑器：按活动目标创建楼层、回复或编辑帖子 */

"use client";

import type { MentionIdentity } from "@/lib/thread-identity";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useCreatePost, type CreatePostArgs } from "@/api/hooks/use-create-post";
import { useUpdatePost } from "@/api/hooks/use-update-post";
import { useUploadImage } from "@/api/hooks/use-upload-image";
import {
  API_ERROR_CODE,
  getApiError,
  isContentUnavailableError,
} from "@/api/errors";
import { useContentAccessCache } from "@/api/hooks/use-content-access-cache";
import { useEditorSubmission } from "@/components/editor/use-editor-submission";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { Button } from "@/components/ui/button";
import { useThreadComposer, useThreadComposerSession } from "@/components/thread/thread-composer-context";
import { hasVisibleMarkdownContent } from "@/lib/markdown";
import type { UploadImageOptions } from "@/lib/upload-image";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import { useThreadIdentitySubmission } from "@/components/thread/use-thread-identity-submission";
import { ThreadPublicationIdentity } from "@/components/thread/thread-publication-identity";
import { usePublicInviteConfirmation } from "@/components/shared/use-public-invite-confirmation";

function getErrorMessage(error: unknown, fallback: string) {
  const err = getApiError(error);
  if (err.code === API_ERROR_CODE.OPTIMISTIC_LOCK_CONFLICT) {
    return "内容已被修改，请刷新后重试";
  }
  if (err.code === 40302) return "该子贴仅限协作者发帖";
  if (err.code === 40303) return "该子贴仅限玩家发帖";
  return err.message || fallback;
}

function ThreadComposer({ mentionIdentities }: { mentionIdentities?: readonly MentionIdentity[] }) {
  const editor = useEditorSubmission();
  const [syncError, setSyncError] = useState(false);
  const { clearThread } = useContentAccessCache();
  const {
    session,
    threadId,
    content,
    pending,
    pendingCreate,
    setPendingCreate,
    identitySelection,
    setIdentitySelection,
    setContent,
    setPending,
    close,
    setEditorValid,
    registerCloseGuard,
    onDocumentChange,
  } = useThreadComposer();
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const uploadImage = useUploadImage();
  const { visibility, rpIdentitySupported } = useThreadPermissions();
  const identity = useThreadIdentitySubmission(threadId, rpIdentitySupported ?? false, Boolean(session && session.type !== "edit"), session?.key, { value: identitySelection, onChange: setIdentitySelection });
  const [uncertain, setUncertain] = useState(Boolean(pendingCreate));
  const [initialContent] = useState(content);
  const { confirmPublicInvite, resetPublicInviteConfirmation } = usePublicInviteConfirmation();
  const containerRef = useRef<HTMLDivElement>(null);
  const submissionLock = useRef(false);
  const createRequestRef = useRef<CreatePostArgs | null>(pendingCreate);
  const storeCreateRequest = (request: CreatePostArgs | null) => { createRequestRef.current = request; setPendingCreate(request); };

  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session?.key]);

  const canClose = editor.canClose;
  useEffect(() => registerCloseGuard(() => {
    if (createRequestRef.current) { toast.error("发表结果尚未确认，请先重试确认发表"); return false; }
    return canClose();
  }), [canClose, registerCloseGuard]);
  useEffect(() => { setEditorValid(!editor.invalid); }, [editor.invalid, setEditorValid]);

  if (!session) return null;

  const isEdit = session.type === "edit";
  const isReply = session.type === "reply";
  const submitLabel = uncertain ? "重试确认发表" : isEdit ? "保存修改" : isReply ? "回复" : "发布";
  const busy = pending || uploadImage.isPending;
  const showIdentity = !isEdit && rpIdentitySupported && Boolean(threadId);

  const submitOnce = async () => {
    if (busy || syncError) return;
    const nextContent = createRequestRef.current?.content ?? editor.flush();
    if (nextContent === null) return;
    if (!hasVisibleMarkdownContent(nextContent)) {
      toast.error("正文和骰子不能同时为空");
      return;
    }
    if (!uncertain && !(await confirmPublicInvite(nextContent, visibility !== "PRIVATE"))) return;

    if (!uncertain && !editor.isCurrent(nextContent)) return;
    setPending(true);
    try {
      if (session.type === "edit") {
        await updatePost.mutateAsync({
          postId: session.postId,
          content: nextContent,
          version: session.version,
        });
      } else {
        if (!createRequestRef.current) {
          const publicationIdentity = await identity.prepare();
          if (publicationIdentity === null) { setPending(false); return; }
          if (!editor.isCurrent(nextContent)) { setPending(false); return; }
          storeCreateRequest({
            subthreadId: session.subthreadId, content: nextContent,
            clientRequestId: crypto.randomUUID(), ...publicationIdentity,
            ...(session.type === "reply" ? { parentPostId: session.parentPostId, replyToPostId: session.replyToPostId } : {}),
          });
        }
        await createPost.mutateAsync(createRequestRef.current!);
      }

      resetPublicInviteConfirmation();
      storeCreateRequest(null);
      await close({ force: true });
      toast.success(isEdit ? "已保存" : isReply ? "回复成功" : "发布成功");
    } catch (error: unknown) {
      setPending(false);
      const apiError = getApiError(error);
      const definitive = (apiError.status !== undefined && apiError.status >= 400 && apiError.status < 500)
        || (apiError.code !== undefined && apiError.code >= 40000 && apiError.code < 50000);
      if (definitive) { storeCreateRequest(null); setUncertain(false); }
      else if (createRequestRef.current) setUncertain(true);
      if (apiError.code === API_ERROR_CODE.RP_IDENTITY_CHANGED) {
        identity.requireConfirmation();
        toast.error("发言身份已变化，正文已保留。再次发表前请确认身份。"); return;
      }
      if (apiError.code === API_ERROR_CODE.RP_MENTION_CHANGED) {
        toast.error("提及对象的身份已变化，请重新选择提及；正文已保留。"); return;
      }
      if (isContentUnavailableError(error)) {
        await close({ force: true });
        if (threadId) clearThread(threadId);
        toast.error("内容已删除或当前无法访问");
        return;
      }
      toast.error(getErrorMessage(error, isEdit ? "保存失败，请稍后重试" : "发布失败，请稍后重试"));
    }
  };

  const handleSubmit = async () => {
    if (submissionLock.current) return;
    submissionLock.current = true;
    try { await submitOnce(); } finally { submissionLock.current = false; }
  };

  const handleUploadImage = (file: File, options?: UploadImageOptions) => (
    uploadImage.mutateAsync(file, options)
  );

  return (
    <div ref={containerRef} className="space-y-3 rounded-[var(--radius-control)] border border-brand-strong/40 bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          {showIdentity && threadId ? <ThreadPublicationIdentity controller={identity} threadId={threadId} disabled={busy || uncertain} /> : null}
          {!showIdentity || session.label !== "发表回复" ? <p className="text-sm font-medium text-foreground">{session.label}</p> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => { if (editor.canClose()) void close(); }}
          disabled={busy || uncertain}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          取消
        </Button>
      </div>
      {uncertain ? <p role="alert" className="text-sm text-warning">发表结果尚未确认，正文与身份已保留。请重试确认发表，确认前不能切换身份或退出编辑。</p> : null}
      <MilkdownEditor mentionIdentities={mentionIdentities}
        onSyncErrorChange={setSyncError}
        editorRef={editor.editorRef}
        onValidityChange={editor.onValidityChange}
        key={session.key}
        defaultValue={initialContent}
        mediaDisplays={session.mediaDisplays}
        onChange={(value) => { editor.onSynchronized(); setContent(value); }}
        onDocumentChange={() => { editor.onDocumentChange(); onDocumentChange(); }}
        onUploadImage={handleUploadImage}
        placeholder={isReply ? "输入回复内容…" : isEdit ? "编辑正文内容…" : "输入正文内容…"}
        disabled={pending || uncertain}
        maxHeight={isReply ? 200 : 300}
        minHeight={isReply ? 120 : 180}
        threadId={threadId}
        diceRolls={session.diceRolls}
        ariaLabel={isReply ? "回复正文" : isEdit ? "编辑正文" : "楼层正文"}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={syncError || (!editor.hasPendingChanges && !hasVisibleMarkdownContent(content)) || busy || (!uncertain && !isEdit && rpIdentitySupported && !identity.query.data)}
        >
          {busy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : isEdit ? (
            <Check className="mr-1.5 h-4 w-4" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function ThreadComposerOutlet({ anchorId, mentionIdentities }: { anchorId: string; mentionIdentities?: readonly MentionIdentity[] }) {
  const { session } = useThreadComposerSession();
  if (session?.anchorId !== anchorId) return null;
  return <ThreadComposer key={session.key} mentionIdentities={mentionIdentities} />;
}
