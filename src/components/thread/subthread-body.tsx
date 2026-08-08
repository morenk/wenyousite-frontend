/** SubthreadBody：子贴标题 + 一楼正文同容器展示（正文不进入回复楼层列表） */

"use client";

import { MarkdownContent } from "@/components/thread/markdown-content";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";
import { hasVisibleMarkdownContent } from "@/lib/markdown";

interface SubthreadBodyProps {
  subthread: SubthreadDetail;
  isDefault?: boolean;
}

export function SubthreadBody({ subthread, isDefault = false }: SubthreadBodyProps) {
  const content = subthread.bodyPost?.content ?? "";

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl font-bold text-foreground">{subthread.title}</h2>
        {isDefault && (
          <span className="rounded-md bg-accent px-1.5 py-0.5 font-utility text-xs font-bold text-brand-strong">
            主帖
          </span>
        )}
      </div>

      {hasVisibleMarkdownContent(content) ? (
        <div className="mt-3 border-t border-border pt-3">
          <MarkdownContent content={content} diceRolls={subthread.bodyPost?.diceRolls} sourcePostId={subthread.bodyPost?.id} />
        </div>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          暂无正文
        </p>
      )}
    </div>
  );
}
