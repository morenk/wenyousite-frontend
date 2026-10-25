"use client";

import { useEffect, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import { useEditorVisualViewport } from "./use-editor-visual-viewport";
import { Button } from "@/components/ui/button";

import { EditorTextFontPicker, type EditorFontControls } from "./editor-text-font-picker";
import { EditorTextColorPicker, type EditorColorControls } from "./editor-text-color-picker";

export function EditorHeadingMenu({ anchor, level, onSelect, onClose, colorControls, fontControls }: {
  level?: 0 | 2 | 3;
  colorControls?: EditorColorControls;
  fontControls?: EditorFontControls;
  anchor: HTMLElement | null;
  onSelect: (level: 0 | 2 | 3) => void;
  onClose: () => void;
}) {
  const [fontMode, setFontMode] = useState(false);
  const [custom, setCustom] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const viewport = useEditorVisualViewport(Boolean(anchor));
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
    if (fontMode) { fontControls?.onCancel(); return; }
    if (details.reason === "escape-key" && custom) { colorControls?.onCancel(); return; }
    if (details.reason === "escape-key") anchor.focus();
    onClose();
  }}>
    <Popover.Portal><Popover.Positioner anchor={anchor} positionMethod="fixed" collisionBoundary={viewport} side="bottom" align="start" sideOffset={6} collisionPadding={8} className="z-[var(--layer-nested-popup)]">
      <Popover.Popup data-editor-style-menu ref={menuRef} tabIndex={-1} initialFocus={menuRef} style={viewport ? { maxHeight: `min(var(--available-height), ${Math.max(0, viewport.height - 16)}px)` } : undefined} finalFocus={false} role="dialog" aria-label={fontMode ? "字体" : "正文样式"} className={cn("grid max-h-(--available-height) min-w-32 max-w-(--available-width) gap-2 overflow-y-auto rounded-[var(--radius-panel)] border border-border bg-popover p-2 shadow-popover outline-none", fontMode && "flex min-h-0 overflow-hidden p-1")}>
        {!custom && !fontMode && <div className="flex items-center justify-between gap-3">
          <div role="group" className="inline-flex items-center gap-0.5 rounded-[var(--radius-control)] bg-muted p-0.5" aria-label="段落样式">
            {([0, 2, 3] as const).map(option => <Button key={option} variant="ghost" size="sm" className="h-8 px-3 text-muted-foreground hover:bg-popover aria-pressed:bg-popover aria-pressed:text-foreground aria-pressed:shadow-sm" aria-pressed={level === option} aria-label={option ? `标题 ${option}` : "正文"} onClick={() => onSelect(option)}>{option ? `H${option}` : "正文"}</Button>)}
          </div>
          {fontControls && <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" disabled={!fontControls.enabled} onClick={event => { event.currentTarget.focus({ preventScroll: true }); setFontMode(true); }}>字体</Button>}
        </div>}
        {fontMode && fontControls && <EditorTextFontPicker controls={fontControls} />}
        {!fontMode && colorControls && <EditorTextColorPicker controls={colorControls} onModeChange={setCustom} />}
      </Popover.Popup>
    </Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}
