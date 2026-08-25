/** 主题帖详情统一编辑器：按活动目标创建楼层、回复或编辑帖子 */

"use client";

import { useEffect, useRef } from "react";
import { Check, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useCreatePost } from "@/api/hooks/use-create-post";
import { useUpdatePost } from "@/api/hooks/use-update-post";
import { useUploadImage } from "@/api/hooks/use-upload-image";
import {
  API_ERROR_CODE,
  getApiError,
  isContentUnavailableError,
} from "@/api/errors";
import { useContentAccessCache } from "@/api/hooks/use-content-access-cache";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { Button } from "@/components/ui/button";
import { useThreadComposer } from "@/components/thread/thread-composer-context";
import { hasVisibleMarkdownContent } from "@/lib/markdown";
import type { UploadImageOptions } from "@/lib/upload-image";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
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

function ThreadComposer() {
  const { clearThread } = useContentAccessCache();
  const {
    session,
    threadId,
    content,
    pending,
    setContent,
    setPending,
    close,
  } = useThreadComposer();
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const uploadImage = useUploadImage();
  const { visibility } = useThreadPermissions();
  const { confirmPublicInvite, resetPublicInviteConfirmation } = usePublicInviteConfirmation();
  const containerRef = useRef<HTMLDivElement>(null);
  const createRequestRef = useRef<{ fingerprint: string; id: string } | null>(null);

  useEffect(() => {
    createRequestRef.current = null;
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session?.key]);

  if (!session) return null;

  const isEdit = session.type === "edit";
  const isReply = session.type === "reply";
  const submitLabel = isEdit ? "保存修改" : isReply ? "回复" : "发布";
  const busy = pending || uploadImage.isPending;

  const handleSubmit = async () => {
    const nextContent = content;
    if (busy) return;
    if (!hasVisibleMarkdownContent(nextContent)) {
      toast.error("正文和骰子不能同时为空");
      return;
    }
    if (!(await confirmPublicInvite(nextContent, visibility !== "PRIVATE"))) return;

    setPending(true);
    try {
      if (session.type === "edit") {
        await updatePost.mutateAsync({
          postId: session.postId,
          content: nextContent,
          version: session.version,
        });
      } else {
        const parentPostId = session.type === "reply" ? session.parentPostId : null;
        const replyToPostId = session.type === "reply" ? session.replyToPostId : null;
        const fingerprint = JSON.stringify({
          subthreadId: session.subthreadId,
          content: nextContent,
          parentPostId,
          replyToPostId,
        });
        if (createRequestRef.current?.fingerprint !== fingerprint) {
          createRequestRef.current = { fingerprint, id: crypto.randomUUID() };
        }
        await createPost.mutateAsync({
          subthreadId: session.subthreadId,
          content: nextContent,
          clientRequestId: createRequestRef.current.id,
          ...(session.type === "reply"
            ? {
                parentPostId: session.parentPostId,
                replyToPostId: session.replyToPostId,
              }
            : {}),
        });
      }

      resetPublicInviteConfirmation();
      createRequestRef.current = null;
      await close({ force: true });
      toast.success(isEdit ? "已保存" : isReply ? "回复成功" : "发布成功");
    } catch (error: unknown) {
      setPending(false);
      if (isContentUnavailableError(error)) {
        await close({ force: true });
        if (threadId) clearThread(threadId);
        toast.error("内容已删除或当前无法访问");
        return;
      }
      toast.error(getErrorMessage(error, isEdit ? "保存失败，请稍后重试" : "发布失败，请稍后重试"));
    }
  };

  const handleUploadImage = (file: File, options?: UploadImageOptions) => (
    uploadImage.mutateAsync(file, options)
  );

  return (
    <div ref={containerRef} className="space-y-3 rounded-lg border border-brand-strong/40 bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{session.label}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => void close()}
          disabled={busy}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          取消
        </Button>
      </div>
      <MilkdownEditor
        key={session.key}
        defaultValue={session.initialContent}
        onChange={setContent}
        onUploadImage={handleUploadImage}
        placeholder={isReply ? "输入回复内容…" : isEdit ? "编辑正文内容…" : "输入正文内容…"}
        disabled={pending}
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
          disabled={!hasVisibleMarkdownContent(content) || busy}
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

export function ThreadComposerOutlet({ anchorId }: { anchorId: string }) {
  const { session } = useThreadComposer();
  if (session?.anchorId !== anchorId) return null;
  return <ThreadComposer />;
}
