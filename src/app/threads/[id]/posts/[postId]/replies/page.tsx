/** 独立楼中楼阅读页：加载原楼层上下文与分页回复 */

"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { usePost } from "@/api/hooks/use-post";
import { isContentUnavailableError } from "@/api/errors";
import { useContentAccessCache } from "@/api/hooks/use-content-access-cache";
import { ReplyDiscussion } from "@/components/thread/reply-discussion";
import {
  ThreadComposerProvider,
  useThreadComposer,
} from "@/components/thread/thread-composer-context";
import { ThreadPermissionsProvider } from "@/components/thread/thread-permissions-context";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout/page-shell";

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
  const { clearPost, clearThread } = useContentAccessCache();
  const { isInitialized } = useAuth();
  const { close: closeComposer } = useThreadComposer();
  const focusedReplyId = searchParams.get("post") ?? undefined;
  const rootPostQuery = usePost(params.postId);
  const focusedReplyQuery = usePost(focusedReplyId);
  const { data: rootPost, isLoading, error } = rootPostQuery;
  const { data: focusedReply } = focusedReplyQuery;

  const invalidRoot = Boolean(
    rootPost &&
      (rootPost.thread.id !== params.id ||
        rootPost.parentPostId !== null ||
        rootPost.floorNumber === null),
  );
  const invalidFocusedReply = Boolean(
    focusedReplyId &&
      focusedReply &&
      (!rootPost ||
        focusedReply.thread.id !== params.id ||
        focusedReply.parentPostId !== rootPost.id),
  );
  const rootUnavailable = isContentUnavailableError(error) || invalidRoot;
  const focusedReplyUnavailable = Boolean(
    focusedReplyId &&
      (isContentUnavailableError(focusedReplyQuery.error) || invalidFocusedReply),
  );

  useEffect(() => {
    if (!rootUnavailable) return;
    void closeComposer({ force: true });
    clearThread(params.id, { preserveActive: true });
  }, [clearThread, closeComposer, params.id, rootUnavailable]);

  useEffect(() => {
    if (!focusedReplyId || !focusedReplyUnavailable) return;
    void closeComposer({ force: true });
    clearPost(focusedReplyId, { preserveActive: true });
  }, [
    closeComposer,
    clearPost,
    focusedReplyId,
    focusedReplyUnavailable,
  ]);

  const awaitingRootValidation = rootPostQuery.isFetching && !rootPostQuery.isFetchedAfterMount;
  const awaitingFocusedValidation = Boolean(
    focusedReplyId &&
      focusedReplyQuery.isFetching &&
      !focusedReplyQuery.isFetchedAfterMount,
  );

  if (isLoading || awaitingRootValidation || awaitingFocusedValidation || (!isInitialized && error)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在进入讨论…
      </div>
    );
  }

  if (
    error ||
    invalidRoot ||
    focusedReplyQuery.error ||
    invalidFocusedReply ||
    !rootPost
  ) {
    return (
      <PageShell width="content" className="py-12">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-9 w-9 text-muted-foreground" />
            <h1 className="text-lg font-semibold">讨论不存在或无法访问</h1>
            <p className="text-sm text-muted-foreground">原楼层可能已删除，或你没有查看该主题帖的权限。</p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const validFocusedReply = focusedReplyId ? focusedReply : undefined;

  return <ReplyDiscussion rootPost={rootPost} focusedReply={validFocusedReply} />;
}
