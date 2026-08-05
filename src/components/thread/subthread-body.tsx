/** SubthreadBody：子贴标题 + 一楼正文同容器展示（正文不进入回复楼层列表） */

"use client";

import { MarkdownContent } from "@/components/thread/markdown-content";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";
import { DiceRolls } from "@/components/thread/dice-rolls";

interface SubthreadBodyProps {
  subthread: SubthreadDetail;
  isDefault?: boolean;
}

export function SubthreadBody({ subthread, isDefault = false }: SubthreadBodyProps) {
  const content = subthread.bodyPost?.content?.trim();

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-foreground">{subthread.title}</h2>
        {isDefault && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
            主帖
          </span>
        )}
      </div>

      {content ? (
        <div className="mt-3 border-t border-border pt-3">
          <MarkdownContent content={content} />
          <DiceRolls
            className="mt-3"
            rolls={subthread.bodyPost?.diceRolls}
            pendingNotations={subthread.bodyPost?.pendingDiceNotations}
          />
        </div>
      ) : subthread.bodyPost && (
        (subthread.bodyPost.diceRolls?.length ?? 0) > 0 ||
        (subthread.bodyPost.pendingDiceNotations?.length ?? 0) > 0
      ) ? (
        <div className="mt-3 border-t border-border pt-3">
          <DiceRolls
            rolls={subthread.bodyPost.diceRolls}
            pendingNotations={subthread.bodyPost.pendingDiceNotations}
          />
        </div>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          暂无正文
        </p>
      )}
    </div>
  );
}
