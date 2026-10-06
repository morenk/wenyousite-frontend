"use client";

import { useEffect, useLayoutEffect, useState, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { Loader2, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserIdentitySummary } from "@/components/shared/user-identity-summary";
import type { MediaDisplay } from "@/lib/media-display";

export interface MentionMenuItem {
  id: string;
  label: string;
  username?: string;
  mentionHref?: string;
  accountUsername?: string;
  avatar?: string | null;
  avatarDisplay?: MediaDisplay | null;
  relation?: "FOLLOWING" | "PLAYER" | "OWNER" | "COLLABORATOR";
  isGroup?: boolean;
}

interface MentionCandidateMenuProps {
  position: { top: number; left: number } | null;
  items: MentionMenuItem[];
  activeIndex: number;
  pending: boolean;
  error: boolean;
  userMentionsUnavailable?: boolean;
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
  userMentionsUnavailable,
  onRetry,
  onSelect,
}: MentionCandidateMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setViewportWidth(Math.min(document.documentElement.clientWidth, document.documentElement.getBoundingClientRect().width));
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(document.documentElement);
    return () => { window.removeEventListener("resize", measure); observer?.disconnect(); };
  }, []);
  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, items, position?.top, position?.left]);
  if (!position) return null;
  const duplicateOrdinals = new Map<string, number>();
  for (const item of items) {
    if (!item.accountUsername) continue;
    const same = items.filter((other) => other.accountUsername === item.accountUsername
      && other.label === item.label && (other.avatarDisplay?.url ?? other.avatar) === (item.avatarDisplay?.url ?? item.avatar));
    if (same.length > 1) duplicateOrdinals.set(item.id, same.indexOf(item) + 1);
  }
  return createPortal(
    <div
      ref={menuRef}
      role="listbox"
      aria-label="艾特候选"
      className="fixed z-[var(--layer-nested-popup)] w-[min(18rem,calc(100vw-1rem))] overflow-y-auto rounded-[var(--radius-panel)] border border-border bg-popover p-1 text-popover-foreground shadow-popover"
      style={{ top: position.top, maxWidth: Math.max(0, viewportWidth - 16), left: "clamp(8px, " + position.left + "px, calc(" + viewportWidth + "px - min(18rem, " + Math.max(0, viewportWidth - 16) + "px) - 8px))", maxHeight: Math.min(320, Math.max(44, window.innerHeight - position.top - 8)) }}
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
          className="flex w-full items-center justify-center rounded-[var(--radius-control)] px-2.5 py-2 text-sm text-destructive hover:bg-accent/60"
          onMouseDown={(event) => {
            event.preventDefault();
            onRetry();
          }}
        >
          加载失败，点击重试
        </button>
      )}
      {!pending && !error && items.length === 0 && (
        <div role={userMentionsUnavailable ? "status" : undefined} className="px-2.5 py-2 text-sm text-muted-foreground">
          {userMentionsUnavailable ? "暂时无法提及用户" : "暂无可艾特用户"}
        </div>
      )}
      {!pending && !error && items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          aria-label={duplicateOrdinals.has(item.id) ? item.label.replace(/^@/, "") + "，@" + item.accountUsername + "，同名身份" + duplicateOrdinals.get(item.id) : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-2 text-left text-sm",
            index === activeIndex
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/60",
          )}
          data-mention-id={item.id}
          onMouseDown={onSelect}
        >
          <UserIdentitySummary
            appearance={{ name: item.label.replace(/^@/, ""), avatar: item.avatar ?? null, avatarDisplay: item.avatarDisplay }}
            compact truncate accountUsername={item.accountUsername}
            label={item.isGroup ? "仅楼主/协作者" : item.accountUsername ? undefined
              : item.relation === "OWNER" ? "楼主" : item.relation === "COLLABORATOR" ? "协作者"
                : item.relation === "PLAYER" ? "玩家" : item.relation === "FOLLOWING" ? "我关注的人" : undefined}
            avatarSlot={item.isGroup ? <span className="flex size-8 shrink-0 items-center justify-center"><UsersRound className="size-5" aria-hidden /></span> : undefined}
            badges={duplicateOrdinals.has(item.id) ? <span aria-hidden className="shrink-0 text-xs text-muted-foreground">{duplicateOrdinals.get(item.id)}</span> : undefined}
          />
        </button>
      ))}
    </div>,
    document.body,
  );
}
