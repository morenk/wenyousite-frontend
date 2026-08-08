/** 主题帖详情头部：玩法线路、徽章、标题、作者、标签与操作按钮。 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  Heart,
  Gift,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { THREAD_STATUS_META } from "@/lib/thread-presentation";
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
import { Badge } from "@/components/ui/badge";
import { WenyouTipButton } from "@/components/economy/wenyou-tip-button";
import { formatWenyou } from "@/lib/wenyou";
import { ThreadCategoryBadge, ThreadCategoryMarker } from "@/components/thread/thread-category";

interface ThreadDetailHeaderProps {
  thread: ThreadDetail;
  onManage?: () => void;
  onSearch?: () => void;
  isSearchOpen?: boolean;
}

function ThreadActionGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex shrink-0 items-center gap-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

const actionButtonClassName = "rounded-lg text-muted-foreground hover:text-foreground";

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
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
      <ThreadCategoryMarker
        category={thread.category}
        className="absolute inset-y-0 left-0 w-1.5"
      />
      <div className="flex flex-col gap-4">
        {/* 分类 + 状态 */}
        <div className="flex items-center gap-2">
          <ThreadCategoryBadge category={thread.category} />
          <Badge tone={THREAD_STATUS_META[thread.status].badgeTone}>
            {THREAD_STATUS_META[thread.status].label}
          </Badge>
          {thread.visibility === "PRIVATE" && (
            <Badge tone="warning">私密</Badge>
          )}
          {thread.pinned && (
            <Badge tone="brand">置顶</Badge>
          )}
        </div>

        {/* 标题 */}
        <h1 className="font-display text-[1.75rem] leading-9 font-bold tracking-[0.01em] text-foreground">{thread.title}</h1>

        {/* 标签 */}
        {thread.topicTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {thread.topicTags.map(({ tag }) => (
              <TopicTagLink key={tag.id} tag={tag} />
            ))}
          </div>
        )}

        {/* 作者 + 时间 + 统计 */}
        <div className="flex flex-wrap items-center gap-3 font-utility text-xs text-muted-foreground">
          <Link
            href={`/users/${thread.ownerId}`}
            className="font-medium text-foreground hover:text-brand-strong"
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

        {/* 单行操作工具轨：互动、浏览工具与管理职责分组。 */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ThreadActionGroup label="互动操作">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={user ? handleLike : () => router.push("/login")}
                disabled={like.isPending || unlike.isPending}
                aria-label={thread.isLiked
                  ? `取消点赞，当前 ${thread.likeCount} 个赞`
                  : `点赞，当前 ${thread.likeCount} 个赞`}
                title={thread.isLiked
                  ? `取消点赞（当前 ${thread.likeCount}）`
                  : `点赞（当前 ${thread.likeCount}）`}
                className={cn(
                  actionButtonClassName,
                  thread.isLiked && "bg-destructive-soft text-destructive hover:text-destructive",
                )}
              >
                {like.isPending || unlike.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart className={cn("h-4 w-4", thread.isLiked && "fill-current")} />
                )}
              </Button>

              {user && (
                <BookmarkButton
                  threadId={thread.id}
                  isBookmarked={thread.isBookmarked}
                  bookmarkId={thread.bookmarkId}
                  iconOnly
                  className={actionButtonClassName}
                />
              )}

              {user && <ThreadSubscriptionControls thread={thread} />}

              {user && !isOwner && thread.published && (
                <WenyouTipButton
                  target={{
                    type: "THREAD",
                    id: thread.id,
                    recipientUserId: thread.ownerId,
                  }}
                  recipientName={`主题帖「${thread.title}」`}
                  variant="ghost"
                  iconOnly
                  className={actionButtonClassName}
                />
              )}
            </ThreadActionGroup>

            {(onSearch
              || thread.visibility === "PUBLIC"
              || isOwner && thread.published && thread.visibility === "PRIVATE") && (
              <ThreadActionGroup label="浏览工具">
                {onSearch && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="搜索本帖楼层"
                    title="搜索本帖楼层"
                    aria-expanded={isSearchOpen}
                    onClick={onSearch}
                    className={cn(actionButtonClassName, isSearchOpen && "bg-accent text-foreground")}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                )}
                {thread.visibility === "PUBLIC" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="复制主题帖链接"
                    title="复制主题帖链接"
                    onClick={handleCopyThreadLink}
                    className={actionButtonClassName}
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                )}
                {isOwner && thread.published && thread.visibility === "PRIVATE" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleCopyInviteLink}
                    disabled={createInviteLink.isPending}
                    aria-label="生成并复制私密帖邀请链接"
                    title="生成并复制私密帖邀请链接"
                    className={actionButtonClassName}
                  >
                    {createInviteLink.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </ThreadActionGroup>
            )}
          </div>

          {user && (
            !isOwner && currentMember?.playerMarked
            || canManageThread && (!!onManage || isOwner)
          ) && (
            <ThreadActionGroup label="管理操作" className="ml-auto">
              {!isOwner && currentMember?.playerMarked && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleExitPlayer}
                  disabled={exitThreadPlayer.isPending}
                  aria-label="退出玩家身份"
                  title="退出玩家身份"
                  className={actionButtonClassName}
                >
                  {exitThreadPlayer.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                </Button>
              )}
              {canManageThread && onManage && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onManage}
                  aria-label="管理主题帖"
                  title="管理主题帖"
                  className={actionButtonClassName}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              {canManageThread && isOwner && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-lg text-destructive hover:bg-destructive-soft hover:text-destructive"
                  aria-label="删除主题帖"
                  title="删除主题帖"
                  onClick={handleDeleteThread}
                  disabled={deleteThread.isPending}
                >
                  {deleteThread.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </ThreadActionGroup>
          )}
        </div>
      </div>
    </div>
  );
}
