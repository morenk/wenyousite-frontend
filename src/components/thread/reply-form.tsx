/** 楼中楼回复表单：MilkdownEditor 小尺寸 + 发布 */

"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useCreatePost } from "@/api/hooks/use-create-post";
import { useUploadImage } from "@/api/hooks/use-upload-image";
import { useQueryClient } from "@tanstack/react-query";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";
import { Button } from "@/components/ui/button";

interface ReplyFormProps {
  subthreadId: string;
  parentPostId: string;
  /** 回复目标帖 ID（可选）：楼中楼内回复指定回复串内的某条回复；缺省回主楼层 */
  replyToPostId?: string;
  /** 回复目标用户/楼层上下文（可选），用于显示"回复 @xxx" */
  replyToLabel?: string;
  onReplied?: () => void;
}

export function ReplyForm({
  subthreadId,
  parentPostId,
  replyToPostId,
  replyToLabel,
  onReplied,
}: ReplyFormProps) {
  const [content, setContent] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const createPost = useCreatePost();
  const uploadImage = useUploadImage();
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!content.trim()) return;
    try {
      await createPost.mutateAsync({
        subthreadId,
        content: content.trim(),
        parentPostId,
        replyToPostId: replyToPostId ?? parentPostId,
      });
      setContent("");
      setResetKey((k) => k + 1);
      await queryClient.invalidateQueries({
        queryKey: ["replies", parentPostId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["floors", subthreadId],
      });
      toast.success("回复成功");
      onReplied?.();
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 40302) {
        toast.error("该子贴仅限协作者发帖");
      } else if (err.code === 40303) {
        toast.error("该子贴仅限玩家发帖");
      } else {
        toast.error(err.message || "回复失败，请稍后重试");
      }
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {replyToLabel && (
        <p className="text-xs text-muted-foreground">回复 {replyToLabel}</p>
      )}
      <MilkdownEditor
        key={`reply-form-${resetKey}`}
        defaultValue={content}
        onChange={setContent}
        onUploadImage={async (file) => uploadImage.mutateAsync(file)}
        placeholder="回复这条楼层…"
        disabled={createPost.isPending}
        maxHeight={200}
        minHeight={120}
      />
      <div className="flex items-center justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || createPost.isPending}
          size="sm"
        >
          {createPost.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          回复
        </Button>
      </div>
    </div>
  );
}
