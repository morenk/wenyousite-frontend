/** 私密帖邀请落地页：预览邀请并加入主题帖 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useInvitePreview, useJoinThreadByInvite } from "@/api/hooks/use-thread-access-actions";
import { getApiErrorMessage, isContentUnavailableError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThreadCategoryLabel } from "@/components/thread/thread-category";
import { PageShell } from "@/components/layout/page-shell";
import { LoadingState } from "@/components/shared/loading-state";
import { useLoginRedirect } from "@/hooks/use-login-redirect";

export default function JoinByInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const redirectToLogin = useLoginRedirect();
  const { user, isInitialized } = useAuth();
  const [joinFailureToken, setJoinFailureToken] = useState<string>();
  const preview = useInvitePreview(isInitialized && user ? token : undefined);
  const join = useJoinThreadByInvite();
  const joinUnavailable = joinFailureToken === token;
  const awaitingValidation = preview.isFetching && !preview.isFetchedAfterMount;

  useEffect(() => {
    if (isInitialized && !user) {
      redirectToLogin({ replace: true });
    }
  }, [isInitialized, redirectToLogin, user]);

  useEffect(() => {
    if (!awaitingValidation && !preview.error && preview.data?.alreadyJoined) {
      router.replace(`/threads/${preview.data.thread.id}`);
    }
  }, [awaitingValidation, preview.data, preview.error, router]);

  async function handleJoin() {
    try {
      await join.mutateAsync(token);
      toast.success("已加入私密主题帖");
      router.replace(`/threads/${preview.data?.thread.id}`);
    } catch (error: unknown) {
      if (isContentUnavailableError(error)) {
        setJoinFailureToken(token);
        toast.error("邀请链接无效或已失效");
        return;
      }
      toast.error(getApiErrorMessage(error, "加入失败，请稍后重试"));
    }
  }

  if (
    !isInitialized ||
    !user ||
    preview.isLoading ||
    awaitingValidation ||
    preview.data?.alreadyJoined
  ) {
    return <LoadingState label="" className="min-h-0 pt-24" />;
  }

  if (joinUnavailable || preview.error || !preview.data) {
    return <p className="mx-auto mt-24 max-w-lg text-center text-sm text-muted-foreground">邀请链接无效或已失效</p>;
  }

  const thread = preview.data.thread;
  return (
    <PageShell width="narrow" className="py-16">
      <Card>
        <CardHeader><CardTitle>私密主题帖邀请</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h1 className="font-display text-xl font-medium">{thread.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <ThreadCategoryLabel
                category={thread.category}
                categoryInfo={thread.categoryInfo}
              /> · 楼主 {thread.owner.username} · {thread.memberCount} 位参与人
            </p>
          </div>
          <Button
            className="w-full"
            pending={join.isPending}
            pendingLabel="正在加入…"
            onClick={handleJoin}
          >
            接受邀请并加入
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
