/** 主题帖详情头部：页面顶层独立标题区（非卡片）——徽章、标题、作者、标签、操作按钮 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  Gift,
  Link2,
  Loader2,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { THREAD_CATEGORY_META, THREAD_STATUS_META } from "@/lib/thread-presentation";
import { useAuth } from "@/lib/auth";
import { useLikeThread } from "@/api/hooks/use-like-thread";
import { useDeleteThread } from "@/api/hooks/use-delete-thread";
import { getApiErrorMessage } from "@/api/errors";
import {
  useCreateInviteLink,
  useExitThreadPlayer,
} from "@/api/hooks/use-thread-access-actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { BookmarkButton } from "@/components/user/bookmark-button";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import { TopicTagLink } from "@/components/thread/topic-tag-link";
import { ThreadSubscriptionControls } from "@/components/thread/thread-subscription-controls";
import { LevelBadge } from "@/components/shared/level-badge";
import { WenyouTipButton } from "@/components/economy/wenyou-tip-button";
import { formatWenyou } from "@/lib/wenyou";

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
  const {
    currentMember,
    isOwner: roleIsOwner,
    isThreadManager,
  } = useThreadPermissions();
  const isOwner = roleIsOwner || user?.id === thread.ownerId;
  const canManageThread = isThreadManager || isOwner;
  const createInviteLink = useCreateInviteLink();
  const exitThreadPlayer = useExitThreadPlayer();
  const confirmAction = useConfirm();

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

  const handleDeleteThread = async () => {
    const message = thread.published
      ? "确定要删除该主题帖吗？已发布主题帖删除后将无法恢复。"
      : "确定要删除该主题帖吗？草稿删除后将无法恢复。";
    if (
      !(await confirmAction({
        title: "删除主题帖",
        description: message,
        confirmLabel: "删除",
        destructive: true,
      }))
    )
      return;

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
      await navigator.clipboard.writeText(
        `${window.location.origin}/threads/${thread.id}`,
      );
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败，请稍后重试");
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      const invite = await createInviteLink.mutateAsync(thread.id);
      await navigator.clipboard.writeText(
        `${window.location.origin}/join/${invite.token}`,
      );
      toast.success("邀请链接已复制，旧链接已失效");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "邀请链接生成失败"));
    }
  };

  const handleExitPlayer = async () => {
    if (
      !(await confirmAction({
        title: "退出玩家身份",
        description: "确定退出玩家身份吗？参与记录仍会保留。",
        confirmLabel: "确认退出",
        destructive: true,
      }))
    )
      return;
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
              THREAD_CATEGORY_META[thread.category].badgeClassName,
            )}
          >
            {THREAD_CATEGORY_META[thread.category].label}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              THREAD_STATUS_META[thread.status].badgeClassName,
            )}
          >
            {THREAD_STATUS_META[thread.status].label}
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
              <TopicTagLink key={tag.id} tag={tag} />
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
          <LevelBadge level={thread.owner.level} />
          <span>
            {formatDistanceToNow(new Date(thread.createdAt), {
              addSuffix: true,
              locale: zhCN,
            })}
          </span>
          <span>{thread.viewCount} 次浏览</span>
          <span>{thread._count.players} 位玩家</span>
          <span>{thread._count.posts} 楼</span>
          <span className="flex items-center gap-1" title="累计获得温油">
            <Gift className="h-3.5 w-3.5" />
            {formatWenyou(thread.tipTotal)} 升温油
          </span>
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
              {createInviteLink.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              复制邀请链接
            </Button>
          )}
          {user ? (
            <>
              {!isOwner && currentMember?.playerMarked && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExitPlayer}
                  disabled={exitThreadPlayer.isPending}
                >
                  退出玩家身份
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                disabled={like.isPending || unlike.isPending}
                className={
                  thread.isLiked ? "text-rose-500 hover:text-rose-600" : ""
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

              {!isOwner && thread.published && (
                <WenyouTipButton
                  target={{
                    type: "THREAD",
                    id: thread.id,
                    recipientUserId: thread.ownerId,
                  }}
                  recipientName={`主题帖「${thread.title}」`}
                />
              )}

              <BookmarkButton
                threadId={thread.id}
                isBookmarked={thread.isBookmarked}
                bookmarkId={thread.bookmarkId}
              />

              <ThreadSubscriptionControls thread={thread} />

              {canManageThread && (
                <>
                  <Button variant="outline" size="sm" onClick={onManage}>
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
