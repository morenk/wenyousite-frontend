/** 主题帖详情头部：玩法线路、徽章、标题、作者、标签与操作按钮。 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Heart,
  Fuel,
  Link2,
  Loader2,
  LogOut,
  Search,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { THREAD_STATUS_META } from "@/lib/thread-presentation";
import { useAuth } from "@/lib/auth";
import { useLikeThread } from "@/api/hooks/use-like-thread";
import { getApiErrorMessage } from "@/api/errors";
import { useExitThreadPlayer } from "@/api/hooks/use-thread-access-actions";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useConfirm } from "@/components/ui/confirm-provider";
import { BookmarkButton } from "@/components/user/bookmark-button";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import type { SubthreadDetail, ThreadDetail } from "@/api/hooks/use-thread-detail";
import { TopicTagLink } from "@/components/thread/topic-tag-link";
import { ThreadSubscriptionControls } from "@/components/thread/thread-subscription-controls";
import { LevelBadge } from "@/components/shared/level-badge";
import { Badge } from "@/components/ui/badge";
import { WenyouTipButton } from "@/components/economy/wenyou-tip-button";
import { formatWenyou } from "@/lib/wenyou";
import { ThreadCategoryBadge, ThreadCategoryMarker } from "@/components/thread/thread-category";
import { SubthreadSwitcher } from "@/components/thread/subthread-tabs";
import { LIKED_ACTIVE_SURFACE_CLASS_NAME } from "@/lib/like-state";
import { getSubthreadHref } from "@/lib/post-navigation";
import { AdminContentModerationDialog } from "@/components/admin/admin-content-moderation-dialog";

interface ThreadDetailHeaderProps {
  thread: ThreadDetail;
  onManage?: () => void;
  onSearch?: () => void;
  isSearchOpen?: boolean;
  subthreads?: SubthreadDetail[];
  selectedSubthreadId?: string;
  defaultSubthreadId?: string;
  onSubthreadChange?: (id: string) => void;
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
        "flex items-center gap-1",
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
  subthreads = [],
  selectedSubthreadId,
  defaultSubthreadId,
  onSubthreadChange,
}: ThreadDetailHeaderProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { like, unlike } = useLikeThread(thread.id);
  const {
    currentMember,
    isOwner: roleIsOwner,
    isThreadManager,
  } = useThreadPermissions();
  const isOwner = roleIsOwner || user?.id === thread.ownerId;
  const canManageThread = isThreadManager || isOwner;
  const exitThreadPlayer = useExitThreadPlayer();
  const confirmAction = useConfirm();
  const [moderationOpen, setModerationOpen] = useState(false);
  const canModerateThread = thread.visibility === "PUBLIC"
    && (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN");

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

  const handleCopySubthreadLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${getSubthreadHref(
          thread.id,
          selectedSubthreadId,
          defaultSubthreadId,
        )}`,
      );
      toast.success("当前子贴链接已复制");
    } catch {
      toast.error("复制失败，请稍后重试");
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

  const hasBrowseTools = Boolean(
    onSearch
    || thread.visibility === "PUBLIC",
  );
  const hasManagementTools = Boolean(
    user && (
      !isOwner && currentMember?.playerMarked
      || canManageThread && !!onManage
    ),
  );

  return (
    <>
      <div
        data-slot="thread-detail-header"
        className="relative overflow-hidden rounded-2xl border border-border bg-card"
      >
      <ThreadCategoryMarker
        category={thread.category}
        className="absolute inset-y-0 left-0 w-1.5"
      />
      <div className="px-6 pb-5 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <ThreadCategoryBadge category={thread.category} />
            <Badge tone={THREAD_STATUS_META[thread.status].badgeTone}>
              {THREAD_STATUS_META[thread.status].label}
            </Badge>
            {thread.visibility === "PRIVATE" ? <Badge tone="warning">私密</Badge> : null}
            {thread.pinned ? <Badge tone="brand">置顶</Badge> : null}
          </div>

          {(hasBrowseTools || hasManagementTools || canModerateThread) ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasBrowseTools ? (
                <ThreadActionGroup label="浏览工具">
                  {onSearch ? (
                    <Tooltip content={isSearchOpen ? "关闭本帖搜索" : "搜索本帖楼层"}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="搜索本帖楼层"
                        aria-expanded={isSearchOpen}
                        onClick={onSearch}
                        className={cn(actionButtonClassName, isSearchOpen && "bg-accent text-foreground")}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  ) : null}
                  {thread.visibility === "PUBLIC" ? (
                    <Tooltip content="复制主题帖链接">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="复制主题帖链接"
                        onClick={handleCopyThreadLink}
                        className={actionButtonClassName}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  ) : null}
                </ThreadActionGroup>
              ) : null}

              {hasManagementTools ? (
                <ThreadActionGroup label="管理操作">
                  {!isOwner && currentMember?.playerMarked ? (
                    <Tooltip content="退出玩家身份" disabled={exitThreadPlayer.isPending}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleExitPlayer}
                        disabled={exitThreadPlayer.isPending}
                        aria-label="退出玩家身份"
                        className={actionButtonClassName}
                      >
                        {exitThreadPlayer.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="h-4 w-4" />
                        )}
                      </Button>
                    </Tooltip>
                  ) : null}
                  {canManageThread && onManage ? (
                    <Tooltip content="管理主题帖">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onManage}
                        aria-label="管理主题帖"
                        className={actionButtonClassName}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  ) : null}
                </ThreadActionGroup>
              ) : null}
              {canModerateThread ? (
                <ThreadActionGroup label="站务操作">
                  <Tooltip content="站务隐藏主题帖">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setModerationOpen(true)}
                      aria-label="站务隐藏主题帖"
                      className="rounded-lg text-destructive hover:bg-destructive-soft hover:text-destructive"
                    >
                      <ShieldAlert className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                </ThreadActionGroup>
              ) : null}
            </div>
          ) : null}
        </div>

        <h1 className="mt-4 max-w-4xl font-display text-[1.875rem] font-bold leading-10 tracking-[0.01em] text-foreground">
          {thread.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-utility text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Link
              href={`/users/${thread.ownerId}`}
              className="font-medium text-foreground hover:text-brand-strong"
            >
              {thread.owner.username}
            </Link>
            <LevelBadge level={thread.owner.level} />
          </span>
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
            <Fuel className="h-3.5 w-3.5" />
            {formatWenyou(thread.tipTotal)} 升温油
          </span>
        </div>

        {thread.topicTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {thread.topicTags.map(({ tag }) => (
              <TopicTagLink key={tag.id} tag={tag} />
            ))}
          </div>
        ) : null}
      </div>

      <div
        data-slot="thread-detail-toolbar"
        className="border-t border-border bg-muted/25 px-4 py-2.5"
      >
        <div className="flex min-w-0 items-center gap-2">
          {onSubthreadChange ? (
            <SubthreadSwitcher
              subthreads={subthreads}
              selectedId={selectedSubthreadId}
              onChange={onSubthreadChange}
              onCopyCurrent={handleCopySubthreadLink}
              className="min-w-0 max-w-sm flex-1"
            />
          ) : null}

          <ThreadActionGroup
            label="互动操作"
            className="ml-auto shrink-0 flex-nowrap justify-end gap-0.5"
          >
            <Button
              variant="ghost"
              size="compact"
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
                "px-2",
                thread.isLiked && LIKED_ACTIVE_SURFACE_CLASS_NAME,
              )}
            >
              {like.isPending || unlike.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Heart className={cn("h-4 w-4", thread.isLiked && "fill-current")} />
              )}
              <span className="font-utility text-xs tabular-nums">{thread.likeCount}</span>
            </Button>

            {user ? (
              <BookmarkButton
                threadId={thread.id}
                isBookmarked={thread.isBookmarked}
                bookmarkId={thread.bookmarkId}
                iconOnly
                className={actionButtonClassName}
              />
            ) : null}

            {user ? <ThreadSubscriptionControls thread={thread} /> : null}

            {user && !isOwner && thread.published ? (
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
            ) : null}
          </ThreadActionGroup>
        </div>
      </div>
      </div>
      {canModerateThread ? (
        <AdminContentModerationDialog
          target={{ type: "thread", id: thread.id, label: "主题帖" }}
          open={moderationOpen}
          onOpenChange={setModerationOpen}
          onHidden={() => router.replace("/")}
        />
      ) : null}
    </>
  );
}
