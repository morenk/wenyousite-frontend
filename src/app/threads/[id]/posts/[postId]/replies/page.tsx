/** 独立楼中楼阅读页：加载原楼层上下文与分页回复 */

"use client";

import { useParams, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { usePost } from "@/api/hooks/use-post";
import { ReplyDiscussion } from "@/components/thread/reply-discussion";
import { ThreadComposerProvider } from "@/components/thread/thread-composer-context";
import { ThreadPermissionsProvider } from "@/components/thread/thread-permissions-context";
import { Card, CardContent } from "@/components/ui/card";

export default function ReplyDiscussionPage() {
  const params = useParams<{ id: string }>();
  return (
    <ThreadComposerProvider threadId={params.id}>
      <ThreadPermissionsProvider threadId={params.id}>
        <ReplyDiscussionPageContent />
      </ThreadPermissionsProvider>
    </ThreadComposerProvider>
  );
}

function ReplyDiscussionPageContent() {
  const params = useParams<{ id: string; postId: string }>();
  const searchParams = useSearchParams();
  const focusedReplyId = searchParams.get("post") ?? undefined;
  const { data: rootPost, isLoading, error } = usePost(params.postId);
  const { data: focusedReply } = usePost(focusedReplyId);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在进入讨论…
      </div>
    );
  }

  const invalidRoot =
    !rootPost ||
    rootPost.thread.id !== params.id ||
    rootPost.parentPostId !== null ||
    rootPost.floorNumber === null;

  if (error || invalidRoot) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-9 w-9 text-muted-foreground" />
            <h1 className="text-lg font-semibold">讨论不存在或无法访问</h1>
            <p className="text-sm text-muted-foreground">原楼层可能已删除，或你没有查看该主题帖的权限。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const validFocusedReply =
    focusedReply?.parentPostId === rootPost.id ? focusedReply : undefined;

  return <ReplyDiscussion rootPost={rootPost} focusedReply={validFocusedReply} />;
}
