/** 创建主题帖页面：自动创建草稿并编辑发布 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { useCreateThread } from "@/api/hooks/use-create-thread";
import { useThreadDetail } from "@/api/hooks/use-thread-detail";
import { useDeleteThread } from "@/api/hooks/use-delete-thread";
import { ThreadCreateForm } from "@/components/forms/thread-create-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CreateThreadPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuth();
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const createThread = useCreateThread();
  const deleteThread = useDeleteThread();
  const {
    data: thread,
    isLoading: isThreadLoading,
    error: threadError,
    refetch,
  } = useThreadDetail(createdThreadId ?? undefined);

  // 检查登录和邮箱验证（等 auth 初始化完成后再判断，避免 hydration 期间误判为未登录）
  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.emailVerified) {
      toast.error("请先验证邮箱后再发布主题帖");
      router.replace("/verify-email");
    }
  }, [user, router, isInitialized]);

  // 自动创建草稿（用 ref 保证生命周期内只创建一次，避免依赖变化导致无限循环）
  const attemptedRef = useRef(false);
  useEffect(() => {
    if (!isInitialized || !user?.emailVerified || createdThreadId || attemptedRef.current) return;
    attemptedRef.current = true;

    async function initDraft() {
      try {
        setCreating(true);
        const thread = await createThread.mutateAsync({
          category: "DEDUCTION",
          visibility: "PUBLIC",
        });
        setCreatedThreadId(thread.id);
      } catch (error: unknown) {
        const err = error as { code?: number; message?: string };
        if (err.code === 40100) {
          // apiClient 拦截器已清除 token 并跳转登录，页面无需额外处理
          return;
        }
        setCreateError(err.message || "创建草稿失败，请检查网络后重试");
      } finally {
        setCreating(false);
      }
    }

    initDraft();
  }, [user, createdThreadId, createThread, router, isInitialized]);

  async function handleCancel() {
    if (!createdThreadId) {
      router.replace("/");
      return;
    }
    if (confirm("确定要放弃创建吗？草稿将被删除。")) {
      try {
        await deleteThread.mutateAsync(createdThreadId);
        toast.success("已放弃创建");
        router.replace("/");
      } catch (error: unknown) {
        const err = error as { message?: string };
        toast.error(err.message || "删除草稿失败");
      }
    }
  }

  function handlePublished(threadId: string) {
    router.replace(`/threads/${threadId}`);
  }

  if (!isInitialized || creating || isThreadLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {!isInitialized ? "加载中…" : creating ? "正在创建草稿…" : "加载中…"}
        </div>
      </div>
    );
  }

  if (createError || threadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              创建草稿失败
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {createError ||
                (threadError instanceof Error
                  ? threadError.message
                  : "无法加载草稿")}
            </p>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => router.push("/")}>返回首页</Button>
              {createError && (
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  重试
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user || !user.emailVerified || !thread) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">创建主题帖</h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <ThreadCreateForm
            thread={thread}
            onCancel={handleCancel}
            onPublished={handlePublished}
            onRefetch={refetch}
          />
        </CardContent>
      </Card>
    </div>
  );
}
