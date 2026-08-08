/** 独立楼中楼阅读主体：原楼层作为讨论正文，回复作为连续楼层 */

"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { ReplyList } from "@/components/thread/reply-list";
import { ReplyForm } from "@/components/thread/reply-form";
import { UserAvatar } from "@/components/shared/user-avatar";
import { LevelBadge } from "@/components/shared/level-badge";
import { getPostHref } from "@/lib/post-navigation";
import type { ReplyDisplayData } from "@/api/hooks/use-floors";
import type { PostDetail } from "@/api/hooks/use-post";
import { PageShell } from "@/components/layout/page-shell";

interface ReplyDiscussionProps {
  rootPost: PostDetail;
  focusedReply?: ReplyDisplayData;
}

export function ReplyDiscussion({ rootPost, focusedReply }: ReplyDiscussionProps) {
  const originalFloorHref = getPostHref({
    threadId: rootPost.thread.id,
    postId: rootPost.id,
  });

  return (
    <PageShell width="feed">
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
          <p className="text-xs font-medium text-muted-foreground">楼中楼讨论主题</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserAvatar
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
                  原子贴 #{rootPost.floorNumber} 楼 · {formatDistanceToNow(new Date(rootPost.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-5">
          <MarkdownContent content={rootPost.content} diceRolls={rootPost.diceRolls} sourcePostId={rootPost.id} />
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="font-display text-lg font-bold text-foreground">楼中楼讨论</h1>
          <span className="text-sm text-muted-foreground">
            共 {rootPost._count.replies} 条回复
          </span>
        </div>
        <ReplyList postId={rootPost.id} focusedReply={focusedReply} variant="discussion" />
        <div className="mt-4">
          <ReplyForm
            subthreadId={rootPost.subthreadId}
            parentPostId={rootPost.id}
            replyToPostId={rootPost.id}
            label={`回复 #${rootPost.floorNumber} ${rootPost.author.username}`}
          />
        </div>
      </section>
    </PageShell>
  );
}
