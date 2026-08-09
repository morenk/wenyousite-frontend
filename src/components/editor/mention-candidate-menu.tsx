"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { AtSign, Loader2, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MentionMenuItem {
  id: string;
  label: string;
  username?: string;
  relation?: "FOLLOWING" | "PLAYER";
  isGroup?: boolean;
}

interface MentionCandidateMenuProps {
  position: { top: number; left: number } | null;
  items: MentionMenuItem[];
  activeIndex: number;
  pending: boolean;
  error: boolean;
  onRetry: () => void;
  onSelect: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

/** @提及候选菜单的纯展示层，查询与键盘事务由编辑器宿主维护。 */
export function MentionCandidateMenu({
  position,
  items,
  activeIndex,
  pending,
  error,
  onRetry,
  onSelect,
}: MentionCandidateMenuProps) {
  if (!position) return null;
  return createPortal(
    <div
      role="listbox"
      aria-label="艾特候选"
      className="fixed z-[100] w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-popover"
      style={{ top: position.top, left: position.left }}
    >
      {pending && (
        <div className="flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在查找可艾特用户…
        </div>
      )}
      {!pending && error && (
        <button
          type="button"
          className="flex w-full items-center justify-center rounded-md px-2.5 py-2 text-sm text-destructive hover:bg-accent/60"
          onMouseDown={(event) => {
            event.preventDefault();
            onRetry();
          }}
        >
          加载失败，点击重试
        </button>
      )}
      {!pending && !error && items.length === 0 && (
        <div className="px-2.5 py-2 text-sm text-muted-foreground">暂无可艾特用户</div>
      )}
      {!pending && !error && items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
            index === activeIndex
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/60",
          )}
          data-mention-id={item.id}
          onMouseDown={onSelect}
        >
          {item.isGroup ? <UsersRound className="h-4 w-4" /> : <AtSign className="h-4 w-4" />}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <span className="text-xs text-muted-foreground">
            {item.isGroup
              ? "仅楼主/协作者"
              : item.relation === "PLAYER"
                ? "帖内玩家"
                : "我关注的人"}
          </span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
