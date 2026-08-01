/** 子贴折叠卡片组件：标题、发帖权限、楼层数、编辑/删除操作 */

"use client";

import { useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { POSTING_POLICY_LABEL } from "@/lib/post-policy";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

interface SubthreadCardProps {
  subthread: SubthreadDetail;
  isDefault?: boolean;
  showActions?: boolean;
  defaultExpanded?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  children?: React.ReactNode;
}

export function SubthreadCard({
  subthread,
  isDefault = false,
  showActions = false,
  defaultExpanded = false,
  onEdit,
  onDelete,
  children,
}: SubthreadCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card",
        isDefault && "ring-1 ring-primary/20",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-0",
            !expanded && "-rotate-90",
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {subthread.title}
            </span>
            {isDefault && (
              <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                主帖
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {POSTING_POLICY_LABEL[subthread.postingPolicy] ?? subthread.postingPolicy}
          </span>
          <span className="text-xs text-muted-foreground">
            {subthread._count.posts} 楼
          </span>
        </div>
        {showActions && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="编辑子贴"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && !isDefault && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="删除子贴"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      {expanded && children && (
        <div className="border-t border-border px-4 py-3">{children}</div>
      )}
    </div>
  );
}
