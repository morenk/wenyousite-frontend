/** 主题帖详情统一编辑器：按活动目标创建楼层、回复或编辑帖子 */

"use client";

import { readingScrollBehavior } from "@/lib/motion";

import { hashReplyIdentity } from "./thread-reply-draft-store";
import { readRpIdentities } from "@/api/hooks/use-rp-identities";
import { useMarkdownWriteCapability } from "@/api/hooks/use-markdown-write-capability";
import type { MentionIdentity } from "@/lib/thread-identity";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
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
import { useEditorOutsideDismiss } from "@/components/editor/use-editor-outside-dismiss";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
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

function ThreadComposer({ mentionIdentities, resizeEdge }: { mentionIdentities?: readonly MentionIdentity[]; resizeEdge?: "top" | "bottom" }) {
  const editor = useEditorSubmission();
  const [syncError, setSyncError] = useState(false);
  const { clearThread } = useContentAccessCache();
  const {
    session,
    threadId,
    content,
    pending,
    pendingCreate,
    pendingIdentityHash,
    localDraftRecovery,
    localDraftAlternatives,
    recoverLocalDraft,
    setPendingCreate,
    identitySelection,
    setIdentitySelection,
    setSessionContent,
    setSessionMediaDisplays,
    setSessionMediaAudios,
    setPending,
    close,
    setEditorValid,
    registerCloseGuard,
    onDocumentChange,
  } = useThreadComposer();
  const snapshotMarkdownCapability = useMarkdownWriteCapability();
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
  const storeCreateRequest = async (request: CreatePostArgs | null) => { createRequestRef.current = request; await setPendingCreate(request); };

  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: readingScrollBehavior(), block: "nearest" });
  }, [session?.key]);

  const sessionKey = session?.key;
  const editorHandle = editor.editorRef;
  useLayoutEffect(() => () => {
    // 路由卸载前同步最后一个快照；旧目标的迟到回调不能覆盖已切换的编辑会话。
    if (!sessionKey || editorHandle.current?.isComposing?.()) return;
    const snapshot = editorHandle.current?.flush();
    if (snapshot !== null && snapshot !== undefined) {
      setSessionContent(sessionKey, snapshot, localDraftRecovery);
      setSessionMediaDisplays(sessionKey, editorHandle.current?.getMediaDisplays?.(), localDraftRecovery);
      setSessionMediaAudios(sessionKey, editorHandle.current?.getMediaAudios?.(), localDraftRecovery);
    }
  }, [editorHandle, sessionKey, localDraftRecovery, setSessionContent, setSessionMediaDisplays, setSessionMediaAudios]);

  const canClose = editor.canClose;
  useEffect(() => registerCloseGuard(() => {
    if (createRequestRef.current) { toast.error("发表结果尚未确认，请先重试确认发表"); return false; }
    if (uploadImage.isPending) { toast.error("图片正在上传，请完成或取消上传后重试"); return false; }
    const allowed = canClose();
    if (allowed && sessionKey) { setSessionMediaDisplays(sessionKey, editorHandle.current?.getMediaDisplays?.(), localDraftRecovery); setSessionMediaAudios(sessionKey, editorHandle.current?.getMediaAudios?.(), localDraftRecovery); }
    return allowed;
  }), [canClose, editorHandle, registerCloseGuard, sessionKey, localDraftRecovery, setSessionMediaDisplays, setSessionMediaAudios, uploadImage.isPending]);
  useEffect(() => { setEditorValid(!editor.invalid); }, [editor.invalid, setEditorValid]);

  const dismiss = useCallback(() => close({ sessionKey }), [close, sessionKey]);
  const outsideDismiss = useEditorOutsideDismiss(dismiss, pending || uploadImage.isPending || uncertain);

  if (!session) return null;

  const isEdit = session.type === "edit";
  const isReply = session.type === "reply";
  const submitLabel = uncertain ? "重试确认发表" : isEdit ? "保存修改" : isReply ? "回复" : "发布";
  const busy = pending || uploadImage.isPending;
  const showIdentity = !isEdit && rpIdentitySupported && Boolean(threadId)
    && (!identity.query.data || (identity.query.data.enabled && identity.query.data.eligible));

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
    const recoveringRequest = Boolean(createRequestRef.current);
    let requestSent = false;
    setPending(true);
    try {
      if (session.type === "edit") {
        requestSent = true;
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
          await storeCreateRequest({
            subthreadId: session.subthreadId, content: nextContent,
            clientRequestId: crypto.randomUUID(), ...publicationIdentity, ...snapshotMarkdownCapability(),
            ...(session.type === "reply" ? { parentPostId: session.parentPostId, replyToPostId: session.replyToPostId } : {}),
          });
        }
        const request = createRequestRef.current!;
        if (request.identityMode === "RP" && !request.identityToken) {
          // 原 token 不落盘；只允许与原摘要相同的当前 token 确认同一 UUID。
          const latest = await readRpIdentities(threadId!);
          const token = latest.identities.find((role) => role.identityId === request.identityId)?.identityToken;
          if (!token || !pendingIdentityHash || await hashReplyIdentity(token) !== pendingIdentityHash) {
            setPending(false);
            toast.error("原发言身份已变化，发表结果仍待确认，请先核对原回复；正文已保留");
            return;
          }
          await storeCreateRequest({ ...request, identityToken: token });
        }
        requestSent = true;
        await createPost.mutateAsync(createRequestRef.current!);
      }

      resetPublicInviteConfirmation();
      await storeCreateRequest(null);
      await close({ force: true, preserveReplyDraft: isEdit });
      toast.success(isEdit ? "已保存" : isReply ? "回复成功" : "发布成功");
    } catch (error: unknown) {
      setPending(false);
      const apiError = getApiError(error);
      if (recoveringRequest) {
        setUncertain(true);
        toast.error("发表结果仍待确认，原请求与正文已保留，请稍后重试");
        return;
      }
      const definitive = (apiError.status !== undefined && apiError.status >= 400 && apiError.status < 500)
        || (apiError.code !== undefined && apiError.code >= 40000 && apiError.code < 50000);
      if ((!requestSent && !recoveringRequest) || (requestSent && definitive && apiError.code !== API_ERROR_CODE.OPTIMISTIC_LOCK_CONFLICT)) { await storeCreateRequest(null); setUncertain(false); }
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
    <div ref={containerRef} {...outsideDismiss} className="space-y-2 rounded-[var(--radius-control)] bg-background">
      {showIdentity && threadId ? <ThreadPublicationIdentity controller={identity} threadId={threadId} disabled={busy || uncertain} /> : null}
      {!isEdit && localDraftAlternatives > 0 ? <Button type="button" variant="ghost" size="sm" disabled={busy || uncertain} onClick={() => void recoverLocalDraft()}>恢复另一份本地稿</Button> : null}
      {uncertain ? <p role="alert" className="text-sm text-warning">发表结果尚未确认，正文与身份已保留。请重试确认发表，确认前不能切换身份或退出编辑。</p> : null}
      <MilkdownEditor allowTextFont allowTextColor audioDraftKey={session.key} mentionIdentities={mentionIdentities}
        headerContent={session.label !== "发表回复" ? (
          <div className="flex items-start gap-2 bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <WenyouIcon id={isEdit ? "action.edit" : "action.reply"} className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words font-medium text-foreground">{session.label}</span>
          </div>
        ) : undefined}
        onSyncErrorChange={setSyncError}
        editorRef={editor.editorRef}
        onValidityChange={editor.onValidityChange}
        key={session.key}
        defaultValue={initialContent}
        mediaDisplays={session.mediaDisplays}
        mediaAudios={session.mediaAudios}
        onChange={(value) => { editor.onSynchronized(); setSessionContent(session.key, value, localDraftRecovery); setSessionMediaDisplays(session.key, editorHandle.current?.getMediaDisplays?.(), localDraftRecovery); setSessionMediaAudios(session.key, editorHandle.current?.getMediaAudios?.(), localDraftRecovery); }}
        onDocumentChange={() => { editor.onDocumentChange(); onDocumentChange(localDraftRecovery); }}
        onUploadImage={handleUploadImage}
        placeholder={isReply ? "输入回复内容…" : isEdit ? "编辑正文内容…" : "输入正文内容…"}
        disabled={pending || uncertain}
        maxHeight={isReply ? 200 : 300}
        minHeight={isReply ? 120 : 180}
        resizeEdge={resizeEdge}
        threadId={threadId}
        diceRolls={session.diceRolls}
        footerActions={
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
        }
        ariaLabel={isReply ? "回复正文" : isEdit ? "编辑正文" : "楼层正文"}
      />
    </div>
  );
}

export function ThreadComposerOutlet({ anchorId, mentionIdentities, resizeEdge }: { anchorId: string; mentionIdentities?: readonly MentionIdentity[]; resizeEdge?: "top" | "bottom" }) {
  const { session, localDraftRecovery } = useThreadComposerSession();
  if (session?.anchorId !== anchorId) return null;
  return <ThreadComposer key={session.key + ":" + localDraftRecovery} mentionIdentities={mentionIdentities} resizeEdge={resizeEdge} />;
}
