"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, type ComponentType, type SVGProps } from "react";
import {
  Code2,
  Dices,
  FileClock,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
} from "lucide-react";
import type { EditorCapabilityId } from "@/lib/editor-capabilities";
import { cn } from "@/lib/utils";

type MenuIcon = ComponentType<SVGProps<SVGSVGElement>>;

const MENU_ICONS: Partial<Record<EditorCapabilityId, MenuIcon>> = {
  strikethrough: Strikethrough,
  draft: FileClock,
  link: Link2,
  "inline-code": Code2,
  quote: Quote,
  "bullet-list": List,
  "ordered-list": ListOrdered,
  hr: Minus,
  dice: Dices,
};

export interface EditorMoreMenuItem {
  id: EditorCapabilityId;
  label: string;
  group: "文字" | "段落" | "创作";
}

interface EditorMoreMenuProps {
  position: { top: number; left: number } | null;
  items: EditorMoreMenuItem[];
  onSelect: (id: EditorCapabilityId, anchor: DOMRect) => void;
  onClose: () => void;
}

/** PC 编辑器的次级能力菜单；移动端按同一分组落为底部面板。 */
export function EditorMoreMenu({ position, items, onSelect, onClose }: EditorMoreMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;
    const menu = menuRef.current;
    menu?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (
        target?.closest("[data-editor-more-menu]") ||
        target?.closest('[data-editor-tool="more"]')
      ) {
        return;
      }
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, position]);

  if (!position) return null;
  const groups = (["文字", "段落", "创作"] as const)
    .map((label) => ({ label, items: items.filter((item) => item.group === label) }))
    .filter((group) => group.items.length > 0);

  return createPortal(
    <div
      ref={menuRef}
      data-editor-more-menu
      role="menu"
      aria-label="更多正文格式"
      className="fixed z-[100] max-h-[min(28rem,calc(100vh-1rem))] w-60 overflow-y-auto rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-popover"
      style={{ top: position.top, left: position.left }}
      onKeyDown={(event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
        );
        if (buttons.length === 0) return;
        event.preventDefault();
        const current = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement));
        const next = event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : event.key === "ArrowDown"
              ? (current + 1) % buttons.length
              : (current - 1 + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }}
    >
      {groups.map((group, groupIndex) => (
        <div
          key={group.label}
          className={cn(groupIndex > 0 && "mt-2 border-t border-border pt-2")}
        >
          <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <div className="grid grid-cols-2 gap-1">
            {group.items.map((item) => {
              const Icon = MENU_ICONS[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none hover:bg-accent/70 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(event) => onSelect(
                    item.id,
                    event.currentTarget.getBoundingClientRect(),
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
