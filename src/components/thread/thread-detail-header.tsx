/** 主题帖详情头部：页面顶层独立标题区（非卡片）——徽章、标题、作者、标签、操作按钮 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Heart, Link2, Loader2, Search, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useLikeThread } from "@/api/hooks/use-like-thread";
import { useDeleteThread } from "@/api/hooks/use-delete-thread";
import { getApiErrorMessage } from "@/api/errors";
import { useSubscriptions } from "@/api/hooks/use-subscriptions";
import { useMembers } from "@/api/hooks/use-members";
import {
  useCreateInviteLink,
  useExitThreadPlayer,
} from "@/api/hooks/use-thread-access-actions";
import {
  useCreateSubscription,
  useDeleteSubscription,
} from "@/api/hooks/use-subscription-mutations";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { BookmarkButton } from "@/components/user/bookmark-button";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
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
  CLOSED: "已停招",
  FINISHED: "已结束",
};

const statusColor: Record<string, string> = {
  RECRUITING: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CLOSED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  FINISHED: "bg-muted text-muted-foreground",
};

interface ThreadDetailHeaderProps {
  thread: ThreadDetail;
  onManage?: () => void;
  onSearch?: () => void;
  isSearchOpen?: boolean;
}

export function ThreadDetailHeader({
  thread,
  onManage,
  onSearch,
  isSearchOpen = false,
}: ThreadDetailHeaderProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { like, unlike } = useLikeThread(thread.id);
  const deleteThread = useDeleteThread();
  const { data: subscriptions } = useSubscriptions(!!user);
  const { currentMember, isOwner: roleIsOwner, isManager, isThreadManager } =
    useThreadPermissions();
  const isOwner = roleIsOwner || user?.id === thread.ownerId;
  const canManageThread = isThreadManager || isOwner;
  const hasAutomaticUpdates = isManager || isOwner;
  const { data: subscriptionCandidateMembers = [] } = useMembers(
    user && !hasAutomaticUpdates ? thread.id : undefined,
  );
  const createSubscription = useCreateSubscription();
  const deleteSubscription = useDeleteSubscription();
  const createInviteLink = useCreateInviteLink();
  const exitThreadPlayer = useExitThreadPlayer();
  const confirmAction = useConfirm();
  const [selectedTargetUserId, setSelectedTargetUserId] = useState("");

  const mySubscription = subscriptions?.find(
    (s) => s.threadId === thread.id && s.type === "THREAD",
  );
  const candidateMembers = subscriptionCandidateMembers.filter(
    (member) =>
      member.role === "PARTICIPANT" &&
      member.playerMarked &&
      member.userId !== user?.id,
  );
  const selectedUserSubscription = subscriptions?.find(
    (subscription) =>
      subscription.threadId === thread.id &&
      subscription.type === "USER" &&
      subscription.targetUserId === selectedTargetUserId,
  );

  const handleLike = async () => {
    try {
      if (thread.isLiked) {
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
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "操作失败，请稍后重试"));
    }
  };

  const handleToggleUserSubscribe = async () => {
    if (!selectedTargetUserId) return;
    try {
      if (selectedUserSubscription) {
        await deleteSubscription.mutateAsync(selectedUserSubscription.id);
        toast.success("已取消该用户的发言订阅");
      } else {
        await createSubscription.mutateAsync({
          threadId: thread.id,
          type: "USER",
          targetUserId: selectedTargetUserId,
        });
        toast.success("已订阅该用户在本帖的发言");
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "操作失败，请稍后重试"));
    }
  };

  const handleDeleteThread = async () => {
    const message = thread.published
      ? "确定要删除该主题帖吗？已发布主题帖删除后将无法恢复。"
      : "确定要删除该主题帖吗？草稿删除后将无法恢复。";
    if (!(await confirmAction({
      title: "删除主题帖",
      description: message,
      confirmLabel: "删除",
      destructive: true,
    }))) return;

    try {
      await deleteThread.mutateAsync(thread.id);
      toast.success("主题帖已删除");
      router.push("/");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "删除失败，请稍后重试"));
    }
  };

  const handleCopyThreadLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/threads/${thread.id}`);
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败，请稍后重试");
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      const invite = await createInviteLink.mutateAsync(thread.id);
      await navigator.clipboard.writeText(`${window.location.origin}/join/${invite.token}`);
      toast.success("邀请链接已复制，旧链接已失效");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "邀请链接生成失败"));
    }
  };

  const handleExitPlayer = async () => {
    if (!(await confirmAction({
      title: "退出玩家身份",
      description: "确定退出玩家身份吗？参与记录仍会保留。",
      confirmLabel: "确认退出",
      destructive: true,
    }))) return;
    try {
      await exitThreadPlayer.mutateAsync(thread.id);
      toast.success("已退出玩家身份");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "退出失败，请稍后重试"));
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
          {onSearch && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="搜索本帖楼层"
              title="搜索本帖楼层"
              aria-expanded={isSearchOpen}
              onClick={onSearch}
            >
              <Search className="mr-1 h-4 w-4" />
              搜索本帖
            </Button>
          )}
          {thread.visibility === "PUBLIC" && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="复制主题帖链接"
              title="复制主题帖链接"
              onClick={handleCopyThreadLink}
            >
              <Link2 className="mr-1 h-4 w-4" />
              复制链接
            </Button>
          )}
          {isOwner && thread.published && thread.visibility === "PRIVATE" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyInviteLink}
              disabled={createInviteLink.isPending}
              title="生成并复制私密帖邀请链接"
            >
              {createInviteLink.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              复制邀请链接
            </Button>
          )}
          {user ? (
            <>
              {!isOwner && currentMember?.playerMarked && (
                <Button variant="ghost" size="sm" onClick={handleExitPlayer} disabled={exitThreadPlayer.isPending}>
                  退出玩家身份
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                disabled={like.isPending || unlike.isPending}
                className={
                  thread.isLiked
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
                      thread.isLiked && "fill-current",
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

              {!hasAutomaticUpdates && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleSubscribe}
                  disabled={createSubscription.isPending || deleteSubscription.isPending}
                  title={mySubscription ? "取消订阅" : "订阅官方更新"}
                >
                  {createSubscription.isPending || deleteSubscription.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : mySubscription ? (
                    <BellOff className="mr-1 h-4 w-4" />
                  ) : (
                    <Bell className="mr-1 h-4 w-4" />
                  )}
                  {mySubscription ? "已订阅官方更新" : "订阅官方更新"}
                </Button>
              )}

              {!hasAutomaticUpdates && candidateMembers.length > 0 && (
                <div className="flex items-center gap-1">
                  <select
                    aria-label="订阅帖内玩家"
                    value={selectedTargetUserId}
                    onChange={(event) => setSelectedTargetUserId(event.target.value)}
                    className="h-8 max-w-32 rounded-md border border-border bg-background px-2 text-xs"
                  >
                    <option value="">选择玩家</option>
                    {candidateMembers.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.user.username}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleUserSubscribe}
                    disabled={
                      !selectedTargetUserId ||
                      createSubscription.isPending ||
                      deleteSubscription.isPending
                    }
                    aria-label={selectedUserSubscription ? "取消订阅该玩家" : "订阅该玩家"}
                  >
                    {selectedUserSubscription ? "取消玩家订阅" : "订阅玩家回复"}
                  </Button>
                </div>
              )}

              {canManageThread && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onManage}
                  >
                    <Settings className="mr-1 h-4 w-4" />
                    管理
                  </Button>
                  {isOwner && (
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
                  )}
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
