/** 主题文档卡：紧凑排头、子贴导航、互动工具与当前子贴正文。 */

"use client";

import { CONTENT_PRESENTATION } from "@wenyousite/foundation/collections";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useLikeThread } from "@/api/hooks/use-like-thread";
import { getApiErrorMessage } from "@/api/errors";
import { useExitThreadPlayer } from "@/api/hooks/use-thread-access-actions";
import { Button } from "@/components/ui/button";
import { InteractionToggle } from "@/components/ui/interaction-toggle";
import { Tooltip } from "@/components/ui/tooltip";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { useConfirm } from "@/components/ui/confirm-provider";
import { BookmarkButton } from "@/components/user/bookmark-button";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import type { SubthreadDetail, ThreadDetail } from "@/api/hooks/use-thread-detail";
import { ThreadSubscriptionControls } from "@/components/thread/thread-subscription-controls";
import { WenyouTipButton } from "@/components/economy/wenyou-tip-button";
import { SubthreadSwitcher } from "@/components/thread/subthread-tabs";
import { ThreadDetailMore } from "@/components/thread/thread-detail-more";
import { TopicTagLink } from "@/components/thread/topic-tag-link";
import { getSubthreadHref } from "@/lib/post-navigation";
import { AdminContentModerationDialog } from "@/components/admin/admin-content-moderation-dialog";
import { WenyouCount } from "@/components/shared/wenyou-count";
import { useLoginRedirect } from "@/hooks/use-login-redirect";

interface ThreadDetailHeaderProps {
  thread: ThreadDetail;
  onManage?: () => void;
  onSearch?: () => void;
  isSearchOpen?: boolean;
  onJumpToLatest?: () => void;
  latestPending?: boolean;
  latestAvailable?: boolean;
  subthreads?: SubthreadDetail[];
  selectedSubthreadId?: string;
  defaultSubthreadId?: string;
  onSubthreadChange?: (id: string) => void;
  onSubthreadPrefetch?: (id: string) => void;
  children?: ReactNode;
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
  onJumpToLatest,
  latestPending = false,
  latestAvailable = true,
  subthreads = [],
  selectedSubthreadId,
  defaultSubthreadId,
  onSubthreadChange,
  onSubthreadPrefetch,
  children,
}: ThreadDetailHeaderProps) {
  const { user } = useAuth();
  const router = useRouter();
  const redirectToLogin = useLoginRedirect();
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
  const canModerateThread =
    thread.visibility === "PUBLIC" &&
    (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN");

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

  return (
    <>
      <article
        data-slot="thread-document"
        data-content-purpose={CONTENT_PRESENTATION.detail.purpose}
        data-content-surface={CONTENT_PRESENTATION.detail.surface}
        className="relative overflow-hidden rounded-2xl border border-border bg-card"
      >
        <header data-slot="thread-detail-header">
          <div
            data-slot="thread-detail-identity"
            className="px-4 py-2.5 sm:px-5 sm:py-3"
          >
            <div className="relative">
              <h1 className="px-10 text-center font-display text-[1.375rem] font-medium leading-8 tracking-[0.01em] text-foreground sm:text-2xl sm:leading-9">
                {thread.title}
              </h1>

              <div className="absolute right-0 top-0">
                <ThreadDetailMore
                  thread={thread}
                  onCopyLink={
                    thread.visibility === "PUBLIC"
                      ? handleCopyThreadLink
                      : undefined
                  }
                  onExitPlayer={
                    user && !isOwner && currentMember?.playerMarked
                      ? handleExitPlayer
                      : undefined
                  }
                  exitPlayerPending={exitThreadPlayer.isPending}
                  onManage={canManageThread ? onManage : undefined}
                  onModerate={
                    canModerateThread
                      ? () => setModerationOpen(true)
                      : undefined
                  }
                />
              </div>
            </div>

            {thread.topicTags.length > 0 ? (
              <div
                data-slot="thread-detail-context"
                aria-label="主题标签"
                className="mt-0.5 flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 font-utility text-[11px] leading-5 text-muted-foreground sm:text-xs"
              >
                {thread.topicTags.map(({ tag }) => (
                  <TopicTagLink key={tag.id} tag={tag} appearance="plain" />
                ))}
              </div>
            ) : null}
          </div>
          <div
            data-slot="thread-detail-toolbar"
            className="border-t border-border bg-muted/25 px-2.5 py-1.5"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              {onSubthreadChange ? (
                <SubthreadSwitcher
                  subthreads={subthreads}
                  selectedId={selectedSubthreadId}
                  onChange={onSubthreadChange}
                  onPrefetch={onSubthreadPrefetch}
                  onCopyCurrent={handleCopySubthreadLink}
                  className="min-w-0 max-w-sm flex-1"
                />
              ) : null}

              {onSearch || onJumpToLatest ? (
                <ThreadActionGroup
                  label="浏览工具"
                  className={onSubthreadChange ? undefined : "ml-auto"}
                >
                  {onJumpToLatest ? (
                    <Tooltip
                      content={
                        latestPending
                          ? "正在定位最新发言"
                          : latestAvailable
                            ? "跳到最新发言"
                            : "暂无楼层或回复"
                      }
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="跳到最新发言"
                        aria-busy={latestPending}
                        disabled={!latestAvailable}
                        pending={latestPending}
                        pendingLabel={
                          <span className="sr-only">正在定位最新发言</span>
                        }
                        onClick={onJumpToLatest}
                        className={actionButtonClassName}
                      >
                        <WenyouIcon id="navigation.explore" className="size-4" />
                      </Button>
                    </Tooltip>
                  ) : null}
                  {onSearch ? (
                    <Tooltip
                      content={isSearchOpen ? "关闭本帖搜索" : "搜索本帖楼层"}
                    >
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="搜索本帖楼层"
                        aria-expanded={isSearchOpen}
                        onClick={onSearch}
                        className={cn(
                          actionButtonClassName,
                          isSearchOpen && "bg-accent text-foreground",
                        )}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  ) : null}
                </ThreadActionGroup>
              ) : null}

              <ThreadActionGroup
                label="互动操作"
                className="ml-auto shrink-0 flex-nowrap justify-end gap-0.5"
              >
                <InteractionToggle
                  tone="like"
                  pressed={thread.isLiked}
                  pending={like.isPending || unlike.isPending}
                  icon="action.like"
                  size="compact"
                  onClick={user ? handleLike : () => redirectToLogin()}
                  accessibleName="点赞"
                  accessibleDescription={`当前 ${thread.likeCount} 个赞`}
                  actionTitle={
                    thread.isLiked
                      ? `取消点赞（当前 ${thread.likeCount}）`
                      : `点赞（当前 ${thread.likeCount}）`
                  }
                  className={cn(actionButtonClassName, "px-2")}
                >
                  <WenyouCount value={thread.likeCount} label="点赞" className="text-xs" />
                </InteractionToggle>

                {user ? (
                  <BookmarkButton
                    threadId={thread.id}
                    isBookmarked={thread.isBookmarked}
                    bookmarkId={thread.bookmarkId}
                    contentLabel={thread.title}
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
        </header>

        {children ? (
          <div
            data-slot="thread-document-body"
            className="border-t border-border px-5 py-5 sm:px-6 sm:py-6"
          >
            {children}
          </div>
        ) : null}
      </article>
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
