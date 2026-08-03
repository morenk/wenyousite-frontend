/** 主题帖编辑页：草稿使用发布表单，已发布帖子使用修改表单 */

"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, ShieldAlert } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { useThreadDetail } from "@/api/hooks/use-thread-detail";
import { ThreadCreateForm } from "@/components/forms/thread-create-form";
import { ThreadEditForm } from "@/components/forms/thread-edit-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function EditThreadPage() {
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

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, router, isInitialized]);

  const isOwner = !!user && user.id === thread?.ownerId;

  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载中…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
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
      </div>
    );
  }

  if (!user || !thread) return null;

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <ShieldAlert className="h-10 w-10 text-muted-foreground" />
              <EmptyState
                title="无权编辑"
                description="只有帖主可以编辑该主题帖"
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
      </div>
    );
  }

  if (!thread.published) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">继续编辑草稿</h1>
        </div>
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
              onRefetch={refetch}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">编辑主题帖</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ThreadEditForm
            thread={thread}
            onBack={() => router.push(`/threads/${threadId}`)}
            onSaved={refetch}
          />
        </CardContent>
      </Card>
    </div>
  );
}
