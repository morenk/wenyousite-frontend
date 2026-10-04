/** SubthreadBody：主题文档卡内的当前子贴正文（正文不进入回复楼层列表）。 */

"use client";

import { ThreadPostAuthor } from "@/components/thread/thread-post-author";
import { MarkdownContent } from "@/components/thread/markdown-content";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";
import { hasVisibleMarkdownContent } from "@/lib/markdown";

interface SubthreadBodyProps {
  subthread: SubthreadDetail;
  threadId?: string;
  isDefault?: boolean;
  threadTitle?: string;
}

export function SubthreadBody({
  subthread,
  threadId,
  isDefault = false,
  threadTitle,
}: SubthreadBodyProps) {
  const content = subthread.bodyPost?.content ?? "";
  const hideRepeatedTitle = isDefault
    && threadTitle?.trim() === subthread.title.trim();
  const titleId = `subthread-${subthread.id}-title`;

  return (
    <section data-slot="subthread-body" aria-labelledby={titleId}>
      <h2
        id={titleId}
        className={hideRepeatedTitle
          ? "sr-only"
          : "font-display text-xl font-medium leading-8 text-foreground"}
      >
        {subthread.title}
      </h2>

      {threadId && subthread.bodyPost?.author ? <div className="mt-3 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <ThreadPostAuthor author={subthread.bodyPost.author} threadId={threadId} subthreadId={subthread.id} postId={subthread.bodyPost.id} body avatarClassName="size-6" avatarTextClassName="text-xs" textClassName="text-xs" />
        <span>正文作者</span>
      </div> : null}
      {hasVisibleMarkdownContent(content) ? (
        <div className={hideRepeatedTitle ? undefined : "mt-5"}>
          <MarkdownContent mentionIdentities={subthread.bodyPost?.mentionIdentities} mediaDisplays={subthread.bodyPost?.mediaDisplays} content={content} diceRolls={subthread.bodyPost?.diceRolls} sourcePostId={subthread.bodyPost?.id} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          暂无正文
        </p>
      )}
    </section>
  );
}
