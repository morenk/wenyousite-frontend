/** SubthreadBody：主题文档卡内的当前子贴正文（正文不进入回复楼层列表）。 */

"use client";

import { MarkdownContent } from "@/components/thread/markdown-content";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";
import { hasVisibleMarkdownContent } from "@/lib/markdown";

interface SubthreadBodyProps {
  subthread: SubthreadDetail;
  isDefault?: boolean;
  threadTitle?: string;
  position?: number;
  total?: number;
}

export function SubthreadBody({
  subthread,
  isDefault = false,
  threadTitle,
  position,
  total,
}: SubthreadBodyProps) {
  const content = subthread.bodyPost?.content ?? "";
  const hideRepeatedTitle = isDefault
    && threadTitle?.trim() === subthread.title.trim();
  const locationLabel = isDefault
    ? "主帖正文"
    : position && total
      ? `子贴 ${position} / ${total}`
      : "子贴正文";
  const titleId = `subthread-${subthread.id}-title`;

  return (
    <section data-slot="subthread-body" aria-labelledby={titleId}>
      <p className="font-utility text-xs font-bold tracking-[0.08em] text-brand-strong">
        {locationLabel}
      </p>
      <h2
        id={titleId}
        className={hideRepeatedTitle
          ? "sr-only"
          : "mt-1.5 font-display text-xl font-bold leading-8 text-foreground"}
      >
        {subthread.title}
      </h2>

      {hasVisibleMarkdownContent(content) ? (
        <div className={hideRepeatedTitle ? "mt-4" : "mt-5"}>
          <MarkdownContent content={content} diceRolls={subthread.bodyPost?.diceRolls} sourcePostId={subthread.bodyPost?.id} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          暂无正文
        </p>
      )}
    </section>
  );
}
