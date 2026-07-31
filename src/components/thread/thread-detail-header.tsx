/** 主题帖详情头部组件：标题、分类、状态、作者、时间、操作按钮 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, LogIn, LogOut, Edit3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useLikeThread } from "@/api/hooks/use-like-thread";
import { useMemberActions } from "@/api/hooks/use-member-actions";
import { Button } from "@/components/ui/button";
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
  isMember: boolean;
}

export function ThreadDetailHeader({ thread, isMember }: ThreadDetailHeaderProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { like, unlike } = useLikeThread(thread.id);
  const { join, exit } = useMemberActions(thread.id);
  const isOwner = user?.id === thread.ownerId;

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

  const handleJoin = async () => {
    try {
      await join.mutateAsync();
      toast.success("已加入主题帖");
    } catch {
      toast.error("加入失败，请稍后重试");
    }
  };

  const handleExit = async () => {
    try {
      await exit.mutateAsync();
      toast.success("已退出主题帖");
    } catch {
      toast.error("操作失败，请稍后重试");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
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
          <span>{thread._count.members} 人参与</span>
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

              {!isOwner && (
                <>
                  {isMember ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExit}
                      disabled={exit.isPending}
                    >
                      {exit.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="mr-1 h-4 w-4" />
                      )}
                      退出
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleJoin}
                      disabled={join.isPending}
                    >
                      {join.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <LogIn className="mr-1 h-4 w-4" />
                      )}
                      加入
                    </Button>
                  )}
                </>
              )}

              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/threads/${thread.id}/edit`)}
                >
                  <Edit3 className="mr-1 h-4 w-4" />
                  编辑
                </Button>
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
