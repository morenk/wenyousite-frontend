"use client";

import { Popover } from "@base-ui/react/popover";
import { Button } from "@/components/ui/button";

export function EditorHeadingMenu({ anchor, onSelect, onClose }: {
  anchor: HTMLElement | null;
  onSelect: (level: 0 | 2 | 3) => void;
  onClose: () => void;
}) {
  if (!anchor) return null;
  return <Popover.Root open onOpenChange={(open) => { if (!open) { anchor.focus(); onClose(); } }}>
    <Popover.Portal><Popover.Positioner anchor={anchor} side="bottom" align="end" sideOffset={6} className="z-[var(--layer-nested-popup)]">
      <Popover.Popup finalFocus={false} role="dialog" aria-label="正文样式" className="grid min-w-32 rounded-[var(--radius-panel)] border border-border bg-popover p-1 shadow-popover">
        {([0, 2, 3] as const).map((level) => <Button key={level} variant="ghost" onClick={() => onSelect(level)}>{level ? `标题 ${level}` : "正文"}</Button>)}
      </Popover.Popup>
    </Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}
