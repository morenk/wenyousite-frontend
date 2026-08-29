"use client";

import { Popover } from "@base-ui/react/popover";
import type { EditorCapabilityId } from "@/lib/editor-capabilities";
import { editorIconId, isEditorIconCapability } from "@/lib/editor-icons";
import { cn } from "@/lib/utils";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import type { IconSemanticId } from "@wenyousite/foundation/icons";

export interface EditorMoreMenuItem {
  id: EditorCapabilityId;
  label: string;
  group: "文字" | "段落" | "创作";
  iconId?: IconSemanticId;
}

interface EditorMoreMenuProps {
  anchor: HTMLElement | null;
  items: EditorMoreMenuItem[];
  onSelect: (id: EditorCapabilityId, anchor: DOMRect) => void;
  onClose: () => void;
}

/** PC 编辑器的次级能力菜单；移动端按同一分组落为底部面板。 */
export function EditorMoreMenu({ anchor, items, onSelect, onClose }: EditorMoreMenuProps) {
  if (!anchor) return null;
  const groups = (["文字", "段落", "创作"] as const)
    .map((label) => ({ label, items: items.filter((item) => item.group === label) }))
    .filter((group) => group.items.length > 0);

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
            data-editor-more-menu
            role="menu"
            aria-label="更多正文格式"
            finalFocus={false}
            className="max-h-[min(28rem,var(--available-height))] w-60 max-w-[var(--available-width)] overflow-y-auto rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-popover outline-none"
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
                    if (!isEditorIconCapability(item.id)) return null;
                    const iconId = item.iconId ?? editorIconId(item.id);
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
                        <WenyouIcon id={iconId} className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
