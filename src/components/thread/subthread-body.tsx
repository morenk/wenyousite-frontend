/** SubthreadBody：子贴标题 + 一楼正文同容器展示（正文不进入回复楼层列表） */

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

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
        <div className="mt-3 border-t border-border pt-3 prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          暂无正文
        </p>
      )}
    </div>
  );
}
