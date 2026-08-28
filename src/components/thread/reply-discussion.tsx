/** 独立楼中楼阅读主体：原楼层作为讨论正文，回复作为连续楼层 */

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { ReplyList } from "@/components/thread/reply-list";
import { ThreadComposerOutlet } from "@/components/thread/thread-composer";
import { useThreadComposer } from "@/components/thread/thread-composer-context";
import {
  getReplyComposerAnchorId,
  ReplyForm,
} from "@/components/thread/reply-form";
import { FloatingComposerDock } from "@/components/thread/floating-composer-dock";
import { UserAvatarLink } from "@/components/shared/user-avatar";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { LevelBadge } from "@/components/shared/level-badge";
import { getPostHref } from "@/lib/post-navigation";
import type { ReplyDisplayData } from "@/api/hooks/use-floors";
import type { PostDetail } from "@/api/hooks/use-post";
import { PageShell } from "@/components/layout/page-shell";
import {
  getVisibleContentText,
  PostActionsMenu,
} from "@/components/thread/post-actions-menu";
import { useAuth } from "@/lib/auth";

interface ReplyDiscussionProps {
  rootPost: PostDetail;
  focusedReply?: ReplyDisplayData;
}

export function ReplyDiscussion({ rootPost, focusedReply }: ReplyDiscussionProps) {
  const { user } = useAuth();
  const { session, open } = useThreadComposer();
  const originalFloorHref = getPostHref({
    threadId: rootPost.thread.id,
    postId: rootPost.id,
  });
  const composerAnchorId = getReplyComposerAnchorId(rootPost.id);
  const editAnchorId = `floor-edit:${rootPost.id}`;
  const rootContentId = `discussion-root-content-${rootPost.id}`;
  const isAuthor = user?.id === rootPost.authorId;
  const isEditing = session?.key === `edit:${rootPost.id}`;

  const handleStartEdit = () => {
    void open({
      key: `edit:${rootPost.id}`,
      anchorId: editAnchorId,
      type: "edit",
      subthreadId: rootPost.subthreadId,
      postId: rootPost.id,
      version: rootPost.version,
      label: `编辑 #${rootPost.floorNumber ?? ""}`.trim(),
      initialContent: rootPost.content,
      diceRolls: rootPost.diceRolls,
    });
  };

  return (
    <PageShell width="feed">
      <h1 className="sr-only">{rootPost.thread.title}的楼层回复</h1>
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={originalFloorHref} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          返回原楼层
        </Link>
        <span>·</span>
        <Link href={`/threads/${rootPost.thread.id}`} className="truncate hover:text-foreground">
          {rootPost.thread.title}
        </Link>
        <span>·</span>
        <Link href={originalFloorHref} className="truncate hover:text-foreground">
          {rootPost.subthread.title}
        </Link>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserAvatarLink
                userId={rootPost.authorId}
                name={rootPost.author.username}
                src={rootPost.author.avatar}
                className="h-9 w-9"
                textClassName="text-sm"
              />
              <div>
                <Link
                  href={`/users/${rootPost.authorId}`}
                  className="text-sm font-medium text-foreground hover:text-brand-strong"
                >
                  {rootPost.author.username}
                </Link>
                <LevelBadge level={rootPost.author.level} />
                <p className="text-xs text-muted-foreground">
                  #{rootPost.floorNumber} · <WenyouTime value={rootPost.createdAt} />
                </p>
              </div>
            </div>
            {!isEditing ? (
              <PostActionsMenu
                triggerLabel="更多原楼层操作"
                menuLabel="原楼层操作"
                copyText={() => getVisibleContentText(rootContentId, rootPost.content)}
                copyContentId={rootContentId}
                copyHref={originalFloorHref}
                onEdit={isAuthor ? handleStartEdit : undefined}
                moderationTarget={{
                  type: "post",
                  id: rootPost.id,
                  label: `楼层 #${rootPost.floorNumber ?? ""}`.trim(),
                }}
              />
            ) : null}
          </div>
        </div>
        <div className="px-5 py-5">
          {isEditing ? (
            <ThreadComposerOutlet anchorId={editAnchorId} />
          ) : (
            <div id={rootContentId}>
              <MarkdownContent
                content={rootPost.content}
                diceRolls={rootPost.diceRolls}
                sourcePostId={rootPost.id}
              />
            </div>
          )}
        </div>
      </section>

      <section className="mt-4" aria-label={`楼层回复，共 ${rootPost._count.replies} 条`}>
        <ReplyList
          postId={rootPost.id}
          focusedReply={focusedReply}
          variant="discussion"
        />
        <FloatingComposerDock sessionAnchorId={composerAnchorId}>
          <ReplyForm
            subthreadId={rootPost.subthreadId}
            parentPostId={rootPost.id}
            replyToPostId={rootPost.id}
            label={`回复 #${rootPost.floorNumber} ${rootPost.author.username}`}
          />
        </FloatingComposerDock>
      </section>
    </PageShell>
  );
}
