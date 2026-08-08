/** 主题帖编辑兼容路由：草稿继续编辑，已发布帖子复用统一管理界面 */

"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, ShieldAlert } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { useThreadDetail } from "@/api/hooks/use-thread-detail";
import { ThreadCreateForm } from "@/components/forms/thread-create-form";
import { ManagementPanel } from "@/components/thread/management-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  ThreadPermissionsProvider,
  useThreadPermissions,
} from "@/components/thread/thread-permissions-context";

export default function EditThreadPage() {
  const params = useParams();
  const threadId = params.id as string;
  return (
    <ThreadPermissionsProvider threadId={threadId}>
      <EditThreadPageContent />
    </ThreadPermissionsProvider>
  );
}

function EditThreadPageContent() {
  const params = useParams();
  const router = useRouter();
  const threadId = params.id as string;
  const { user, isInitialized } = useAuth();

  const {
    data: thread,
    isLoading,
    error,
    refetch,
  } = useThreadDetail(threadId);
  const { isOwner, isCollaborator, isLoading: isPermissionsLoading } =
    useThreadPermissions();

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, router, isInitialized]);

  const canEdit = isOwner || isCollaborator;

  if (!isInitialized || isLoading || isPermissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载中…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <PageShell width="content" className="py-12">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              <EmptyState
                title="主题帖不存在或已被删除"
                description="该帖子可能尚未发布、已被删除或为私密帖"
              />
              <Button variant="outline" size="sm" onClick={() => router.push("/")}>
                返回首页
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!user || !thread) return null;

  if (!canEdit) {
    return (
      <PageShell width="content" className="py-12">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <ShieldAlert className="h-10 w-10 text-muted-foreground" />
              <EmptyState
                title="无权编辑"
                description="只有楼主或协作者可以编辑该主题帖"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/threads/${threadId}`)}
              >
                返回帖子
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!thread.published && isOwner) {
    return (
      <PageShell width="workspace">
        <PageHeader title="继续编辑草稿" />
        <Card>
          <CardHeader>
            <CardTitle>草稿内容</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ThreadCreateForm
              thread={thread}
              cancelMode="back"
              onCancel={() => router.push("/threads/create")}
              onPublished={(publishedThreadId) =>
                router.replace(`/threads/${publishedThreadId}`)
              }
            />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <div className="h-screen w-full px-2 py-4 sm:px-4">
      <ManagementPanel
        thread={thread}
        initialView="thread"
        onExit={() => router.push(`/threads/${threadId}`)}
        onRefetch={refetch}
      />
    </div>
  );
}
