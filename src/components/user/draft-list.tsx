/** 草稿箱列表：我的未发布帖，可继续编辑或删除 */

"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { FileEdit, Trash2, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useDrafts } from "@/api/hooks/use-drafts";
import { useDeleteThread } from "@/api/hooks/use-delete-thread";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export function DraftList() {
  const { data: drafts, isLoading, error, refetch } = useDrafts();
  const deleteThread = useDeleteThread();
  const queryClient = useQueryClient();

  const handleDelete = async (threadId: string) => {
    if (!confirm("确定要删除该草稿吗？删除后无法恢复。")) return;
    try {
      await deleteThread.mutateAsync(threadId);
      await queryClient.invalidateQueries({ queryKey: ["drafts"] });
      toast.success("草稿已删除");
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || "删除失败，请稍后重试");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <EmptyState title="草稿加载失败" description="请稍后重试" />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    );
  }

  if (!drafts || drafts.length === 0) {
    return (
      <EmptyState
        title="还没有草稿"
        description="去创建主题帖吧，未发布的内容会保留在这里"
      />
    );
  }

  return (
    <div className="space-y-3">
      {drafts.map((draft) => (
        <div
          key={draft.id}
          className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
        >
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {draft.category}
              </span>
              {draft._count.posts > 0 && (
                <span className="text-xs text-muted-foreground">
                  {draft._count.posts} 个楼层
                </span>
              )}
            </div>
            <Link
              href={`/threads/${draft.id}/edit`}
              className="block truncate text-sm font-semibold text-foreground hover:text-primary"
            >
              {draft.title || "未命名草稿"}
            </Link>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              更新于{" "}
              {formatDistanceToNow(new Date(draft.updatedAt), {
                addSuffix: true,
                locale: zhCN,
              })}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link href={`/threads/${draft.id}/edit`}>
              <Button variant="outline" size="sm">
                <FileEdit className="mr-1.5 h-3.5 w-3.5" />
                继续编辑
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => handleDelete(draft.id)}
              disabled={deleteThread.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
