/** 主题帖详情头部：页面顶层独立标题区（非卡片）——徽章、标题、作者、标签、操作按钮 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Edit3, Settings, Loader2, Bell, BellOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useLikeThread } from "@/api/hooks/use-like-thread";
import { useDeleteThread } from "@/api/hooks/use-delete-thread";
import { useSubscriptions } from "@/api/hooks/use-subscriptions";
import {
  useCreateSubscription,
  useDeleteSubscription,
} from "@/api/hooks/use-subscription-mutations";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BookmarkButton } from "@/components/user/bookmark-button";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";

const categoryLabel: Record<string, string> = {
  DEDUCTION: "演绎",
  NATION: "国策",
  RPG: "RPG",
};

const categoryColor: Record<string, string> = {
  DEDUCTION: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  NATION: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  RPG: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

const statusLabel: Record<string, string> = {
  RECRUITING: "招募中",
  CLOSED: "已关闭",
  FINISHED: "已完结",
};

const statusColor: Record<string, string> = {
  RECRUITING: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CLOSED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  FINISHED: "bg-muted text-muted-foreground",
};

interface ThreadDetailHeaderProps {
  thread: ThreadDetail;
  onManage?: () => void;
}

export function ThreadDetailHeader({
  thread,
  onManage,
}: ThreadDetailHeaderProps) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { like, unlike } = useLikeThread(thread.id);
  const deleteThread = useDeleteThread();
  const { data: subscriptions } = useSubscriptions(!!user);
  const createSubscription = useCreateSubscription();
  const deleteSubscription = useDeleteSubscription();
  const isOwner = user?.id === thread.ownerId;

  const mySubscription = subscriptions?.find((s) => s.threadId === thread.id);

  const handleLike = async () => {
    try {
      if (thread.likeCount > 0) {
        await unlike.mutateAsync();
      } else {
        await like.mutateAsync();
      }
    } catch {
      toast.error("操作失败，请稍后重试");
    }
  };

  const handleToggleSubscribe = async () => {
    try {
      if (mySubscription) {
        await deleteSubscription.mutateAsync(mySubscription.id);
        toast.success("已取消订阅");
      } else {
        await createSubscription.mutateAsync({ threadId: thread.id, type: "THREAD" });
        toast.success("已订阅，帖子更新将通知你");
      }
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "操作失败，请稍后重试");
    }
  };

  const handleDeleteThread = async () => {
    const message = thread.published
      ? "确定要删除该主题帖吗？已发布主题帖删除后将无法恢复。"
      : "确定要删除该主题帖吗？草稿删除后将无法恢复。";
    if (!confirm(message)) return;

    try {
      await deleteThread.mutateAsync(thread.id);
      toast.success("主题帖已删除");
      router.push("/");
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "删除失败，请稍后重试");
    }
  };

  return (
    <div className="border-b border-border pb-5">
      <div className="flex flex-col gap-4">
        {/* 分类 + 状态 */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              categoryColor[thread.category] ?? "bg-muted text-muted-foreground",
            )}
          >
            {categoryLabel[thread.category] ?? thread.category}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              statusColor[thread.status] ?? "bg-muted text-muted-foreground",
            )}
          >
            {statusLabel[thread.status] ?? thread.status}
          </span>
          {thread.visibility === "PRIVATE" && (
            <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              私密
            </span>
          )}
          {thread.pinned && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              置顶
            </span>
          )}
        </div>

        {/* 标题 */}
        <h1 className="text-xl font-bold text-foreground">{thread.title}</h1>

        {/* 标签 */}
        {thread.topicTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {thread.topicTags.map(({ tag }) => (
              <span
                key={tag.id}
                className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}

        {/* 作者 + 时间 + 统计 */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Link
            href={`/users/${thread.ownerId}`}
            className="font-medium text-foreground hover:text-primary"
          >
            {thread.owner.username}
          </Link>
          <span>
            {formatDistanceToNow(new Date(thread.createdAt), {
              addSuffix: true,
              locale: zhCN,
            })}
          </span>
          <span>{thread.viewCount} 次浏览</span>
          <span>{thread._count.players} 位玩家</span>
          <span>{thread._count.posts} 楼</span>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 border-t border-border pt-3">
          {user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                disabled={like.isPending || unlike.isPending}
                className={
                  (thread.likeCount > 0)
                    ? "text-rose-500 hover:text-rose-600"
                    : ""
                }
              >
                {like.isPending || unlike.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Heart
                    className={cn(
                      "mr-1 h-4 w-4",
                      thread.likeCount > 0 && "fill-current",
                    )}
                  />
                )}
                {thread.likeCount > 0 ? thread.likeCount : "点赞"}
              </Button>

              <BookmarkButton
                threadId={thread.id}
                isBookmarked={thread.isBookmarked}
                bookmarkId={thread.bookmarkId}
              />

              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleSubscribe}
                disabled={createSubscription.isPending || deleteSubscription.isPending}
                title={mySubscription ? "取消订阅" : "订阅帖子更新"}
              >
                {createSubscription.isPending || deleteSubscription.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : mySubscription ? (
                  <BellOff className="mr-1 h-4 w-4" />
                ) : (
                  <Bell className="mr-1 h-4 w-4" />
                )}
                {mySubscription ? "已订阅" : "订阅"}
              </Button>

              {isOwner && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onManage}
                  >
                    <Settings className="mr-1 h-4 w-4" />
                    管理
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/threads/${thread.id}/edit`)}
                  >
                    <Edit3 className="mr-1 h-4 w-4" />
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    title="删除主题帖"
                    onClick={handleDeleteThread}
                    disabled={deleteThread.isPending}
                  >
                    {deleteThread.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-4 w-4" />
                    )}
                    删除
                  </Button>
                </>
              )}
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/login")}
            >
              <Heart className="mr-1 h-4 w-4" />
              {thread.likeCount > 0 ? thread.likeCount : "点赞"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
