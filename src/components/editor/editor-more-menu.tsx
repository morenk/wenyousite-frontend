"use client";

import { useRef } from "react";
import { Popover } from "@base-ui/react/popover";
import type { EditorCapabilityId } from "@/lib/editor-capabilities";
import {
  editorAlignmentIconId,
  editorIconId,
  isEditorIconCapability,
} from "@/lib/editor-icons";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import type { IconSemanticId } from "@wenyousite/foundation/icons";
import {
  alignmentLabel,
  type WenyouTextAlignment,
} from "@/lib/markdown-alignment";

export interface EditorMoreMenuItem {
  id: EditorCapabilityId;
  label: string;
  iconId?: IconSemanticId;
}

interface EditorMoreMenuProps {
  anchor: HTMLElement | null;
  items: EditorMoreMenuItem[];
  alignment: WenyouTextAlignment;
  onSelect: (id: EditorCapabilityId, anchor: DOMRect) => void;
  onSelectAlignment: (alignment: WenyouTextAlignment) => void;
  onClose: () => void;
}

const ALIGNMENTS: readonly WenyouTextAlignment[] = ["left", "center", "right"];

const iconButtonClassName = cn(
  "inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none",
  "transition-[background-color,color,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
  "hover:bg-accent/60 hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]",
);

/** PC 编辑器的纯图标次级工具托盘；文字名称只在悬浮或键盘聚焦时出现。 */
export function EditorMoreMenu({
  anchor,
  items,
  alignment,
  onSelect,
  onSelectAlignment,
  onClose,
}: EditorMoreMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  if (!anchor) return null;

  return (
    <Popover.Root
      open
      onOpenChange={(open, eventDetails) => {
        if (open) return;
        const event = eventDetails.event;
        const target = eventDetails.event.target;
        const relatedTarget = event instanceof FocusEvent ? event.relatedTarget : null;
        const involvesAnchor = event.composedPath().includes(anchor)
          || (target instanceof Node && anchor.contains(target))
          || (relatedTarget instanceof Node
            && (relatedTarget === anchor || anchor.contains(relatedTarget)));
        if (involvesAnchor) {
          eventDetails.cancel();
          return;
        }
        onClose();
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          positionMethod="fixed"
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="z-[var(--layer-nested-popup)] data-anchor-hidden:hidden"
          data-editor-more-positioner
        >
          <Popover.Popup
            ref={menuRef}
            data-editor-more-menu
            role="menu"
            aria-label="更多正文格式"
            tabIndex={-1}
            initialFocus={menuRef}
            finalFocus={false}
            className="max-h-[min(28rem,var(--available-height))] w-80 max-w-[var(--available-width)] origin-(--transform-origin) overflow-y-auto rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-popover outline-none duration-[var(--motion-standard)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none"
          >
            <div className="flex flex-wrap gap-1">
              {items.map((item) => {
                if (item.id === "alignment") {
                  return (
                    <div
                      key={item.id}
                      role="group"
                      aria-label="段落对齐"
                      data-editor-alignment-picker
                      className="inline-grid h-10 shrink-0 grid-cols-3 gap-0.5 rounded-xl bg-muted p-0.5"
                    >
                      {ALIGNMENTS.map((option) => {
                        const label = alignmentLabel(option);
                        return (
                          <Tooltip key={option} content={label}>
                            <button
                              type="button"
                              role="menuitemradio"
                              aria-label={label}
                              aria-checked={alignment === option}
                              data-editor-alignment-option={option}
                              className={cn(
                                "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none",
                                "transition-[background-color,color,box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
                                "hover:bg-popover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]",
                                "aria-checked:bg-accent aria-checked:text-accent-foreground aria-checked:ring-1 aria-checked:ring-primary/70 aria-checked:ring-inset",
                              )}
                              onClick={() => onSelectAlignment(option)}
                            >
                              <WenyouIcon
                                id={editorAlignmentIconId(option)}
                                className="size-[18px]"
                              />
                            </button>
                          </Tooltip>
                        );
                      })}
                    </div>
                  );
                }
                if (!isEditorIconCapability(item.id)) return null;
                const iconId = item.iconId ?? editorIconId(item.id);
                return (
                  <Tooltip key={item.id} content={item.label}>
                    <button
                      type="button"
                      role="menuitem"
                      aria-label={item.label}
                      data-editor-more-item={item.id}
                      className={iconButtonClassName}
                      onClick={(event) => onSelect(
                        item.id,
                        event.currentTarget.getBoundingClientRect(),
                      )}
                    >
                      <WenyouIcon id={iconId} className="size-[18px]" />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
