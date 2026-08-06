/** 创建主题帖页面：先选草稿或新建主题帖，进入编辑器后自动创建草稿并编辑发布 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { useCreateThread } from "@/api/hooks/use-create-thread";
import { useThreadDetail } from "@/api/hooks/use-thread-detail";
import { useDeleteThread } from "@/api/hooks/use-delete-thread";
import { getApiError, getApiErrorMessage } from "@/api/errors";
import { ThreadCreateForm } from "@/components/forms/thread-create-form";
import { ThreadDraftPicker } from "@/components/thread/thread-draft-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-provider";

export default function CreateThreadPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuth();
  const [mode, setMode] = useState<"picker" | "editor">("picker");
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const confirmAction = useConfirm();
  // 点击入口同步上锁，直到离开创建流程；创建请求不得由渲染/effect 驱动。
  const isDraftCreationStarted = useRef(false);

  const createThread = useCreateThread();
  const deleteThread = useDeleteThread();
  const {
    data: thread,
    isLoading: isThreadLoading,
    error: threadError,
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

  async function handleCreateNew() {
    if (!isInitialized || !user?.emailVerified) return;
    if (isDraftCreationStarted.current) return;
    isDraftCreationStarted.current = true;
    setCreateError(null);
    setCreatedThreadId(null);
    setCreating(true);
    setMode("editor");

    try {
      const thread = await createThread.mutateAsync({
        category: "DEDUCTION",
        visibility: "PUBLIC",
      });
      setCreatedThreadId(thread.id);
    } catch (error: unknown) {
      const err = getApiError(error);
      if (err.code === 40100) {
        // apiClient 拦截器已清除 token 并跳转登录，页面无需额外处理
        return;
      }
      setCreateError(err.message || "创建草稿失败，请检查网络后重试");
    } finally {
      setCreating(false);
    }
  }

  function handleReturnToPicker() {
    isDraftCreationStarted.current = false;
    setCreateError(null);
    setCreatedThreadId(null);
    setMode("picker");
  }

  async function handleCancel() {
    if (!createdThreadId) {
      isDraftCreationStarted.current = false;
      setMode("picker");
      return;
    }
    if (await confirmAction({
      title: "放弃创建",
      description: "确定要放弃创建吗？草稿将被删除。",
      confirmLabel: "放弃并删除",
      destructive: true,
    })) {
      try {
        await deleteThread.mutateAsync(createdThreadId);
        isDraftCreationStarted.current = false;
        setCreatedThreadId(null);
        setMode("picker");
        toast.success("已放弃创建");
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, "删除草稿失败"));
      }
    }
  }

  function handlePublished(threadId: string) {
    router.replace(`/threads/${threadId}`);
  }

  if (!isInitialized) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载中…
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
              <Button onClick={handleReturnToPicker}>返回草稿列表</Button>
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

  if (!user || !user.emailVerified) {
    return null;
  }

  if (mode === "picker") {
    return (
      <ThreadDraftPicker onCreateNew={handleCreateNew} />
    );
  }

  if (creating || isThreadLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          正在创建草稿…
        </div>
      </div>
    );
  }

  if (!thread) return null;

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
            />
        </CardContent>
      </Card>
    </div>
  );
}
