/** 精确楼层链接的稳定阅读态：目标与分页列表分离，避免异步内容推动目标。 */

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { ReplyDisplayData } from "@/api/hooks/use-floors";
import type { PostDetail } from "@/api/hooks/use-post";
import { FloorCard } from "@/components/thread/floor-card";
import { ReplyCard } from "@/components/thread/reply-card";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPostHref, getSubthreadHref } from "@/lib/post-navigation";

interface TargetContextProps {
  post: PostDetail;
  defaultSubthreadId?: string;
}

function TargetContext({ post, defaultSubthreadId }: TargetContextProps) {
  return (
    <nav aria-label="目标楼层上下文" className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
      <Link
        href={`/threads/${encodeURIComponent(post.thread.id)}`}
        className="truncate hover:text-foreground"
      >
        {post.thread.title}
      </Link>
      <span aria-hidden="true">·</span>
      <Link
        href={getSubthreadHref(post.thread.id, post.subthread.id, defaultSubthreadId)}
        className="truncate hover:text-foreground"
      >
        {post.subthread.title}
      </Link>
    </nav>
  );
}

interface FloorTargetFocusProps {
  floor: PostDetail;
  defaultSubthreadId: string;
  onViewFullDiscussion: () => void;
}

export function FloorTargetFocus({
  floor,
  defaultSubthreadId,
  onViewFullDiscussion,
}: FloorTargetFocusProps) {
  return (
    <PageShell width="feed">
      <div className="space-y-4" data-testid="floor-target-focus">
        <TargetContext post={floor} defaultSubthreadId={defaultSubthreadId} />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-foreground">
            目标楼层{floor.floorNumber == null ? "" : ` #${floor.floorNumber}`}
          </h1>
          <Button variant="outline" size="sm" onClick={onViewFullDiscussion}>
            查看完整讨论
          </Button>
        </div>
        <FloorCard floor={floor} />
      </div>
    </PageShell>
  );
}

interface ReplyTargetFocusProps {
  rootPost: PostDetail;
  reply: PostDetail;
  onViewFullDiscussion: () => void;
}

export function ReplyTargetFocus({
  rootPost,
  reply,
  onViewFullDiscussion,
}: ReplyTargetFocusProps) {
  const originalFloorHref = getPostHref({
    threadId: rootPost.thread.id,
    postId: rootPost.id,
  });

  return (
    <PageShell width="feed">
      <div className="space-y-4" data-testid="reply-target-focus">
        <TargetContext post={reply} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">目标回复</h1>
            <Link
              href={originalFloorHref}
              className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              回复于楼层 #{rootPost.floorNumber}
            </Link>
          </div>
          <Button variant="outline" size="sm" onClick={onViewFullDiscussion}>
            查看完整讨论
          </Button>
        </div>
        <ReplyCard
          reply={reply as ReplyDisplayData}
          parentPostId={rootPost.id}
          variant="discussion"
        />
      </div>
    </PageShell>
  );
}

/** 深链每次挂载都要重新校验；校验完成前不得泄露 Query 缓存正文。 */
export function PostTargetFocusSkeleton() {
  return (
    <PageShell width="feed">
      <div
        className="min-h-[28rem] space-y-4"
        role="status"
        aria-live="polite"
        aria-label="正在打开目标楼层"
      >
        <p className="text-sm text-muted-foreground">正在打开目标楼层…</p>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-3" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-16" />
            </div>
          </div>
          <Skeleton className="mt-5 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-5/6" />
          <Skeleton className="mt-5 h-3 w-24" />
        </div>
      </div>
    </PageShell>
  );
}
