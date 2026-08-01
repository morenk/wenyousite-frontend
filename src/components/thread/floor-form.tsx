/** 楼层发布表单组件 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useCreatePost } from "@/api/hooks/use-create-post";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

interface FloorFormProps {
  subthreadId: string;
}

export function FloorForm({ subthreadId }: FloorFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [content, setContent] = useState("");
  const createPost = useCreatePost();
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!content.trim()) return;
    try {
      await createPost.mutateAsync({
        subthreadId,
        content: content.trim(),
      });
      setContent("");
      await queryClient.invalidateQueries({
        queryKey: ["floors", subthreadId],
      });
      toast.success("发布成功");
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 40302) {
        toast.error("该子贴仅限协作者发帖");
      } else if (err.code === 40303) {
        toast.error("该子贴仅限玩家发帖");
      } else {
        toast.error(err.message || "发布失败，请稍后重试");
      }
    }
  };

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          登录后即可参与讨论
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/login")}
        >
          <LogIn className="mr-1.5 h-4 w-4" />
          登录
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="输入正文内容（支持 Markdown）..."
        rows={4}
        className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="mt-3 flex items-center justify-end">
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
          发布
        </Button>
      </div>
    </div>
  );
}
