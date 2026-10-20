"use client";

import { useEffect, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Button } from "@/components/ui/button";

import { EditorTextFontPicker, type EditorFontControls } from "./editor-text-font-picker";
import { EditorTextColorPicker, type EditorColorControls } from "./editor-text-color-picker";

export function EditorHeadingMenu({ anchor, onSelect, onClose, colorControls, fontControls }: {
  colorControls?: EditorColorControls;
  fontControls?: EditorFontControls;
  anchor: HTMLElement | null;
  onSelect: (level: 0 | 2 | 3) => void;
  onClose: () => void;
}) {
  const [fontMode, setFontMode] = useState(false);
  const [custom, setCustom] = useState(false);
  useEffect(() => {
    if (!anchor) return;
    anchor.setAttribute("aria-expanded", "true");
    return () => { anchor.setAttribute("aria-expanded", "false"); };
  }, [anchor]);
  if (!anchor) return null;
  return <Popover.Root open onOpenChange={(open, details) => {
    if (open) return;
    const event = details.event;
    const related = event instanceof FocusEvent ? event.relatedTarget : null;
    if (event.composedPath().includes(anchor)
      || (event.target instanceof Node && anchor.contains(event.target))
      || (related instanceof Node && anchor.contains(related))) {
      details.cancel();
      return;
    }
    if (details.reason === "escape-key" && fontMode) { fontControls?.onCancel(); return; }
    if (details.reason === "escape-key" && custom) { colorControls?.onCancel(); return; }
    if (details.reason === "escape-key") anchor.focus();
    onClose();
  }}>
    <Popover.Portal><Popover.Positioner anchor={anchor} side="bottom" align="start" sideOffset={6} collisionPadding={8} className="z-[var(--layer-nested-popup)]">
      <Popover.Popup finalFocus={false} role="dialog" aria-label="正文样式" className="grid max-h-(--available-height) min-w-32 overflow-y-auto rounded-[var(--radius-panel)] border border-border bg-popover p-1 shadow-popover">
        {!custom && !fontMode && ([0, 2, 3] as const).map((level) => <Button key={level} variant="ghost" className="justify-start" onClick={() => onSelect(level)}>{level ? `标题 ${level}` : "正文"}</Button>)}
        {fontMode && fontControls && <EditorTextFontPicker controls={fontControls} />}
        {!custom && !fontMode && fontControls && <Button variant="ghost" className="justify-start" onClick={() => setFontMode(true)}>字体</Button>}
        {!fontMode && colorControls && <EditorTextColorPicker controls={colorControls} onModeChange={setCustom} />}
      </Popover.Popup>
    </Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}
