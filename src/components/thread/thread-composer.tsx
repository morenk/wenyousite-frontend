/** 主题帖详情统一编辑器：按活动目标创建楼层、回复或编辑帖子 */

"use client";

import { useEffect, useRef } from "react";
import { Check, Loader2, Send, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCreatePost } from "@/api/hooks/use-create-post";
import { useUpdatePost } from "@/api/hooks/use-update-post";
import { useUploadImage } from "@/api/hooks/use-upload-image";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { Button } from "@/components/ui/button";
import { useThreadComposer } from "@/components/thread/thread-composer-context";
import { hasVisibleMarkdownContent } from "@/lib/markdown";

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as { code?: number; message?: string };
  if (err.code === 40900) return "内容已被修改，请刷新后重试";
  if (err.code === 40302) return "该子贴仅限协作者发帖";
  if (err.code === 40303) return "该子贴仅限玩家发帖";
  return err.message || fallback;
}

function ThreadComposer() {
  const {
    session,
    content,
    pending,
    setContent,
    setPending,
    close,
  } = useThreadComposer();
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const uploadImage = useUploadImage();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session?.key]);

  if (!session) return null;

  const isEdit = session.type === "edit";
  const isReply = session.type === "reply";
  const submitLabel = isEdit ? "保存修改" : isReply ? "回复" : "发布";

  const invalidateAfterSubmit = async () => {
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: ["floors", session.subthreadId] }),
    ];
    const parentPostId = session.type === "reply"
      ? session.parentPostId
      : session.type === "edit"
        ? session.parentPostId
        : undefined;
    if (parentPostId) {
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: ["replies", parentPostId] }),
      );
    }
    await Promise.all(invalidations);
  };

  const handleSubmit = async () => {
    const nextContent = content.trim();
    if (!hasVisibleMarkdownContent(nextContent) || pending) {
      if (nextContent && !hasVisibleMarkdownContent(nextContent)) {
        toast.error("正文不能只有空白或分隔线");
      }
      return;
    }

    setPending(true);
    try {
      if (session.type === "edit") {
        await updatePost.mutateAsync({
          postId: session.postId,
          content: nextContent,
          version: session.version,
        });
      } else {
        await createPost.mutateAsync({
          subthreadId: session.subthreadId,
          content: nextContent,
          ...(session.type === "reply"
            ? {
                parentPostId: session.parentPostId,
                replyToPostId: session.replyToPostId,
              }
            : {}),
        });
      }

      await invalidateAfterSubmit();
      close({ force: true });
      toast.success(isEdit ? "已保存" : isReply ? "回复成功" : "发布成功");
    } catch (error: unknown) {
      setPending(false);
      toast.error(getErrorMessage(error, isEdit ? "保存失败，请稍后重试" : "发布失败，请稍后重试"));
    }
  };

  const handleUploadImage = async (file: File) => {
    setPending(true);
    try {
      return await uploadImage.mutateAsync(file);
    } finally {
      setPending(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-3 rounded-lg border border-primary/30 bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{session.label}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => close()}
          disabled={pending}
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
      />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!content.trim() || pending}
        >
          {pending ? (
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
