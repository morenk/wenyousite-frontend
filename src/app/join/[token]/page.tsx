/** 私密帖邀请落地页：预览邀请并加入主题帖 */

"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useInvitePreview, useJoinThreadByInvite } from "@/api/hooks/use-thread-access-actions";
import { getApiErrorMessage } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const categoryLabel = { DEDUCTION: "演绎", NATION: "国策", RPG: "RPG" } as const;

export default function JoinByInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, isInitialized } = useAuth();
  const preview = useInvitePreview(isInitialized && user ? token : undefined);
  const join = useJoinThreadByInvite();

  useEffect(() => {
    if (isInitialized && !user) {
      router.replace(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
    }
  }, [isInitialized, router, token, user]);

  useEffect(() => {
    if (preview.data?.alreadyJoined) {
      router.replace(`/threads/${preview.data.thread.id}`);
    }
  }, [preview.data, router]);

  async function handleJoin() {
    try {
      await join.mutateAsync(token);
      toast.success("已加入私密主题帖");
      router.replace(`/threads/${preview.data?.thread.id}`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "加入失败，请稍后重试"));
    }
  }

  if (!isInitialized || !user || preview.isLoading || preview.data?.alreadyJoined) {
    return <Loader2 className="mx-auto mt-24 h-6 w-6 animate-spin text-muted-foreground" />;
  }

  if (preview.error || !preview.data) {
    return <p className="mx-auto mt-24 max-w-lg text-center text-sm text-muted-foreground">邀请链接无效或已失效</p>;
  }

  const thread = preview.data.thread;
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardHeader><CardTitle>私密主题帖邀请</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h1 className="text-lg font-semibold">{thread.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {categoryLabel[thread.category]} · 楼主 {thread.owner.username} · {thread.memberCount} 位参与人
            </p>
          </div>
          <Button className="w-full" disabled={join.isPending} onClick={handleJoin}>
            {join.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            接受邀请并加入
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
