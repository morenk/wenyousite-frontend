"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin,
  useDraggable, useDroppable, useSensor, useSensors, MeasuringStrategy,
  type CollisionDetection, type DragMoveEvent,
} from "@dnd-kit/core";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown, SmilePlus } from "lucide-react";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { EDITOR_CAPABILITY_LABELS } from "@/lib/editor-capabilities";
import { editorAlignmentIconId, editorIconId } from "@/lib/editor-icons";
import { type EditorToolbarTool, isEditorToolbarTool, EDITOR_TOOLBAR_TOOLS } from "@/lib/editor-toolbar-preference";
import { cn } from "@/lib/utils";
import { fitCustomMilkdownToolbar, fitDefaultMilkdownToolbar } from "@/lib/milkdown-toolbar";
import "@/components/editor/milkdown-editor.css";
import { buttonVariants } from "@/components/ui/button";

type Zone = "primary" | "more";
type Layout = Record<Zone, EditorToolbarTool[]>;
interface DropTarget { zone: Zone; index: number }
const ZONE_LABELS = { primary: "主栏", more: "展开栏" } as const;
const iconClass = "inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground";
const defaultGroups: (EditorToolbarTool | "more")[][] = [["heading"], ["bold", "italic", "strikethrough", "inline-code"], ["alignment"], ["link", "image"], ["quote", "hr"], ["dice"], ["draft"], ["sticker"], ["audio"], ["more"]];
interface FittedLayout extends Layout { moreRight: number; moreBottom: number; showMore: boolean; dividers: string[] }

const collisionDetection: CollisionDetection = (args) => {
  const collisions = pointerWithin(args);
  const tools = collisions.filter(({ id }) => String(id).startsWith("slot:"));
  return tools.length ? tools : collisions;
};

/** 直接使用编辑器原样式；主栏和展开托盘的图标尺寸本来不同。 */
function ToolGlyph({ tool, zone }: { tool: EditorToolbarTool | "more"; zone: Zone }) {
  if (zone === "primary" && tool === "heading") return <span className="top-bar-heading-selector inline-flex">
    <span className="top-bar-heading-button"><span className="top-bar-heading-label">正文</span><span className="top-bar-chevron"><ChevronDown /></span></span>
  </span>;
  if (tool === "alignment") return <span className={zone === "primary" ? "flex" : "inline-grid h-10 grid-cols-2 gap-0.5 rounded-[var(--radius-control)] bg-muted p-0.5"}>
    {(["center", "right"] as const).map((alignment) => <span key={alignment}
      className={zone === "primary" ? "top-bar-item" : "flex size-9 items-center justify-center"}>
      <WenyouIcon id={editorAlignmentIconId(alignment)} className={zone === "more" ? "size-[18px]" : undefined} />
    </span>)}
  </span>;
  return <span className={zone === "primary" ? "top-bar-item" : "flex size-10 items-center justify-center"}>
    <WenyouIcon id={editorIconId(tool)} className={zone === "more" ? "size-[18px]" : undefined} />
  </span>;
}

function Tool({ tool, zone, index, total, active, footer = false }: {
  footer?: boolean; tool: EditorToolbarTool; zone: Zone; index: number; total: number; active: boolean;
}) {
  const positionId = useId();
  const node = useRef<HTMLDivElement>(null);
  const previousRect = useRef<DOMRect | null>(null);
  const { setNodeRef: setDragNodeRef, attributes, listeners } = useDraggable({ id: tool, data: { tool, zone } });
  const { setNodeRef: setDropNodeRef } = useDroppable({ id: `slot:${tool}`, data: { tool, zone, index } });
  useLayoutEffect(() => {
    const element = node.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const previous = previousRect.current;
    if (previous && !active && (previous.x !== rect.x || previous.y !== rect.y)
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.animate?.([{ transform: `translate(${previous.x - rect.x}px, ${previous.y - rect.y}px)` }, { transform: "none" }], { duration: 140, easing: "ease-out" });
    }
    previousRect.current = rect;
  }, [index, zone, active]);
  return <div ref={(element) => { node.current = element; setDropNodeRef(element); }} className="relative flex shrink-0"
    data-toolbar-placeholder={active || undefined}>
    <button ref={setDragNodeRef} type="button" {...attributes} {...listeners}
      aria-label={EDITOR_CAPABILITY_LABELS[tool]}
      aria-describedby={`${attributes["aria-describedby"]} ${positionId}`}
      aria-roledescription={undefined} data-toolbar-arrange-tool={tool} title={EDITOR_CAPABILITY_LABELS[tool]}
      className={cn(iconClass, "cursor-grab select-none outline-none focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring! active:cursor-grabbing",
        zone === "more" && "hover:bg-accent/60 hover:text-accent-foreground", footer && buttonVariants({ variant: "ghost", size: "sm" }), active && "opacity-0")}
    ><span aria-hidden="true">{footer ? <span className="flex items-center gap-1.5"><SmilePlus className="size-4" />表情</span> : <ToolGlyph tool={tool} zone={zone} />}</span></button>
    {active ? <span data-toolbar-drop-marker aria-hidden="true" className="pointer-events-none absolute inset-1 rounded-[var(--radius-control)] bg-accent/50 ring-1 ring-primary/60 ring-inset" /> : null}
    <span id={positionId} className="sr-only">{ZONE_LABELS[zone]}，第 {index + 1} 项，共 {total} 项</span>
  </div>;
}

/** 测量副本与 Crepe 具有同一层级和 CSS，直接调用运行时收纳函数，避免另猜断点或项数。 */
function MeasurementToolbar({ layout, custom, audioEnabled, onFit }: { layout: Layout; custom: boolean; audioEnabled: boolean; onFit: (layout: FittedLayout) => void }) {
  const node = useRef<HTMLDivElement>(null);
  const availableTools = useMemo(() => new Set(EDITOR_TOOLBAR_TOOLS.filter((tool) => tool !== "audio" || audioEnabled)), [audioEnabled]);
  const fit = useCallback(() => {
    const toolbar = node.current;
    if (!toolbar) return;
    const more = custom ? fitCustomMilkdownToolbar(toolbar, { version: 1, ...layout }, availableTools)
      : fitDefaultMilkdownToolbar(toolbar, true, true, audioEnabled).filter(isEditorToolbarTool);
    const primary = (custom ? [...layout.primary, ...layout.more] : EDITOR_TOOLBAR_TOOLS).filter((tool) => {
        const item = toolbar.querySelector<HTMLElement>(`[data-editor-tool="${tool === "alignment" ? "align-center" : tool}"]`);
        return item && !item.closest("[hidden]");
      });
    const trigger = toolbar.querySelector<HTMLElement>('[data-editor-tool="more"]');
    const dividers = Array.from(toolbar.querySelectorAll<HTMLElement>(".top-bar-divider")).filter((item) => !item.hidden).map((item) => {
      let next = item.nextElementSibling as HTMLElement | null;
      while (next?.hidden) next = next.nextElementSibling as HTMLElement | null;
      const id = next?.dataset.editorTool;
      return id === "align-center" ? "alignment" : id ?? "";
    });
    onFit({ primary, more, showMore: !trigger?.hidden, dividers,
      moreBottom: trigger ? trigger.getBoundingClientRect().bottom - toolbar.getBoundingClientRect().top : 0,
      moreRight: trigger ? trigger.getBoundingClientRect().right - toolbar.getBoundingClientRect().left : 0 });
  }, [layout, custom, audioEnabled, availableTools, onFit]);
  useLayoutEffect(() => {
    fit();
    const observer = new ResizeObserver(fit);
    if (node.current) observer.observe(node.current);
    return () => observer.disconnect();
  }, [fit]);
  return <div aria-hidden="true" inert className="pointer-events-none invisible milkdown" style={{ position: "absolute", left: 1, right: 1, top: 1 }}>
    <div ref={node} className="milkdown-top-bar"><div className="top-bar-inner">
      {defaultGroups.flatMap((group, index) => [
        ...(index ? [<span key={`divider-${index}`} data-before={group[0]} className="top-bar-divider" />] : []),
        ...group.flatMap((tool) => {
          if (tool === "heading") return <span key={tool} className="top-bar-heading-selector"><span data-editor-tool="heading" className="top-bar-heading-button"><span className="top-bar-heading-label">正文</span><span className="top-bar-chevron"><ChevronDown /></span></span></span>;
          if (tool === "alignment") return (["center", "right"] as const).map((alignment) => <span key={alignment} data-editor-tool={`align-${alignment}`} className="top-bar-item"><WenyouIcon id={editorAlignmentIconId(alignment)} /></span>);
          return <span key={tool} data-editor-tool={tool} className="top-bar-item"><WenyouIcon id={editorIconId(tool)} /></span>;
        }),
      ])}
    </div></div>
  </div>;
}

function DropZone({ zone, children, active, style }: { zone: Zone; children: ReactNode; active: boolean; style?: React.CSSProperties }) {
  const { setNodeRef } = useDroppable({ id: `zone:${zone}`, data: { zone } });
  return <div ref={setNodeRef} data-toolbar-drop-zone={zone} style={style}
    className={cn(zone === "primary" ? "top-bar-inner min-h-11" : "min-h-14 w-80 max-w-full rounded-[var(--radius-panel)] border border-border bg-popover p-2 text-popover-foreground shadow-popover",
      active && "ring-1 ring-primary/40 ring-inset")}>{children}</div>;
}

function moveTool(layout: Layout, tool: EditorToolbarTool, target: DropTarget): Layout {
  const next = { primary: layout.primary.filter((id) => id !== tool), more: layout.more.filter((id) => id !== tool) };
  next[target.zone].splice(Math.min(Math.max(0, target.index), next[target.zone].length), 0, tool);
  return next;
}
const sameLayout = (a: Layout, b: Layout) => a.primary.join() === b.primary.join() && a.more.join() === b.more.join();

export function EditorToolbarArrangement({ primary, more, custom = true, audioEnabled = false, onChange }: Layout & {
  audioEnabled?: boolean;
  custom?: boolean;
  onChange: (primary: EditorToolbarTool[], more: EditorToolbarTool[]) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const morePopup = useRef<HTMLDivElement>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const anchorRef = useCallback((node: HTMLSpanElement | null) => setMoreAnchor(node?.querySelector<HTMLElement>(".top-bar-item") ?? null), []);
  const canceledDrag = useRef(false);
  const [keyboardDrag, setKeyboardDrag] = useState<(DropTarget & { tool: EditorToolbarTool }) | null>(null);
  const [active, setActive] = useState<EditorToolbarTool | null>(null);
  const [draft, setDraft] = useState<Layout | null>(null);
  const draftRef = useRef<Layout | null>(null);
  const [fitted, setFitted] = useState<FittedLayout>({ primary, more, moreRight: 0, moreBottom: 38, showMore: true, dividers: [] });
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 5 } }),
  );
  const layout = useMemo(() => draft ?? { primary, more }, [draft, primary, more]);
  const previewCustom = custom || draft !== null;
  const fit = useCallback((next: FittedLayout) => setFitted((previous) => sameLayout(previous, next)
    && previous.moreRight === next.moreRight && previous.moreBottom === next.moreBottom && previous.showMore === next.showMore
    && previous.dividers.join() === next.dividers.join() ? previous : next), []);
  const changeDraft = (next: Layout | null) => { draftRef.current = next; setDraft(next); };
  const keepUnavailable = (next: Layout, original: Layout): Layout => {
    if (audioEnabled) return next;
    const zone: Zone = original.primary.includes("audio") ? "primary" : "more";
    if (original[zone].includes("audio") && !next[zone].includes("audio")) next[zone].splice(Math.min(original[zone].indexOf("audio"), next[zone].length), 0, "audio");
    return next;
  };
  const baseLayout = () => draftRef.current ?? (custom ? { primary, more } : keepUnavailable({ primary: fitted.primary, more: [...fitted.more, "sticker" as const] }, { primary, more }));
  const focusTool = (tool: EditorToolbarTool) => requestAnimationFrame(() => (root.current?.querySelector<HTMLButtonElement>(`[data-toolbar-arrange-tool="${tool}"]`) ?? morePopup.current?.querySelector<HTMLButtonElement>(`[data-toolbar-arrange-tool="${tool}"]`))?.focus({ preventScroll: true }));
  const commit = (next: Layout, tool: EditorToolbarTool) => {
    if (!sameLayout(next, { primary, more }) || !custom) onChange(next.primary, next.more);
    setAnnouncement(`${EDITOR_CAPABILITY_LABELS[tool]}已放下`);
    focusTool(tool);
  };
  const updateDropTarget = (event: DragMoveEvent) => {
    if (canceledDrag.current || !isEditorToolbarTool(event.active.id)) return;
    const data = event.over?.data.current;
    if (data?.zone !== "primary" && data?.zone !== "more") return;
    const tool = event.active.id;
    if (data.tool === tool) return;
    const zone: Zone = data.zone;
    let base = baseLayout();
    // 在临时溢出项前插入展开工具时，将当前可见分界纳入这次明确的跨栏调整。
    if (zone === "more" && data.tool && base.primary.includes(data.tool)) base = keepUnavailable({ primary: [...fitted.primary], more: [...fitted.more] }, base);
    const items = base[zone].filter((id) => id !== tool);
    let index = zone === "primary" ? fitted.primary.filter((id) => id !== tool).length : items.length;
    if (data.tool) {
      const activator = event.activatorEvent as MouseEvent | TouchEvent;
      const originX = "touches" in activator ? activator.touches[0]?.clientX : activator.clientX;
      const x = (originX ?? 0) + event.delta.x;
      index = Math.max(0, items.indexOf(data.tool)) + (event.over && x > event.over.rect.left + event.over.rect.width / 2 ? 1 : 0);
    }
    const next = moveTool(base, tool, { zone, index });
    if (!sameLayout(next, base)) changeDraft(next);
  };
  const navigateTools = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !isEditorToolbarTool(target.dataset.toolbarArrangeTool)) return;
    const tool = target.dataset.toolbarArrangeTool;
    const base = baseLayout();
    const zone: Zone = base.primary.includes(tool) ? "primary" : "more";
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (keyboardDrag) {
        root.current?.focus({ preventScroll: true });
        commit(moveTool(base, keyboardDrag.tool, keyboardDrag), keyboardDrag.tool);
        setKeyboardDrag(null);
        changeDraft(null);
      } else {
        setKeyboardDrag({ tool, zone, index: base[zone].indexOf(tool) });
        setAnnouncement(`已提起${EDITOR_CAPABILITY_LABELS[tool]}，左右键排序，上下键切换栏，空格放下，Escape 取消`);
      }
      return;
    }
    if (keyboardDrag) {
      if (event.key === "Tab") { setKeyboardDrag(null); setAnnouncement("已取消拖动，布局未改变"); return; }
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = { ...keyboardDrag };
      if (event.key === "ArrowUp") next.zone = "primary";
      if (event.key === "ArrowDown") next.zone = "more";
      const maximum = base[next.zone].filter((id) => id !== next.tool).length;
      if (event.key === "ArrowLeft") next.index--;
      if (event.key === "ArrowRight") next.index++;
      if (event.key === "Home") next.index = 0;
      if (event.key === "End") next.index = maximum;
      next.index = Math.min(Math.max(next.index, 0), maximum);
      setKeyboardDrag(next);
      setAnnouncement(`${EDITOR_CAPABILITY_LABELS[next.tool]}，${ZONE_LABELS[next.zone]}第 ${next.index + 1} 项，空格放下`);
      return;
    }
    const buttons = [...Array.from(root.current?.querySelectorAll<HTMLButtonElement>("[data-toolbar-arrange-tool]") ?? []), ...Array.from(morePopup.current?.querySelectorAll<HTMLButtonElement>("[data-toolbar-arrange-tool]") ?? [])];
    const index = buttons.indexOf(target);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next]?.focus({ preventScroll: true });
  };
  const moving = active ?? keyboardDrag?.tool;
  const tools = (zone: Zone) => fitted[zone].flatMap((tool, index) => [
    ...(zone === "primary" && !previewCustom && fitted.dividers.includes(tool) ? [<span key={`divider-${tool}`} className="top-bar-divider" />] : []),
    <Tool key={tool} tool={tool} zone={zone} index={index} total={fitted[zone].length} active={moving === tool} />,
  ]);
  useEffect(() => {
    if (!active && !keyboardDrag) return;
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (!active) event.stopPropagation();
      canceledDrag.current = true;
      setActive(null); setKeyboardDrag(null); draftRef.current = null; setDraft(null);
      setAnnouncement("已取消拖动，布局未改变");
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, [active, keyboardDrag]);

  return <div ref={root} tabIndex={-1} className="relative outline-none" data-toolbar-arrangement onKeyDown={navigateTools}>
    <MeasurementToolbar layout={layout} custom={previewCustom} audioEnabled={audioEnabled} onFit={fit} />
    <DndContext sensors={sensors} collisionDetection={collisionDetection} autoScroll={active !== null}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} cancelDrop={() => canceledDrag.current}
      accessibility={{
        screenReaderInstructions: { draggable: "空格或 Enter 提起及放下工具，左右键调整位置，上下键切换主栏和展开栏，Escape 取消。" },
        announcements: {
          onDragStart: ({ active: item }) => `正在移动${EDITOR_CAPABILITY_LABELS[item.id as EditorToolbarTool]}`,
          onDragOver: ({ over }) => canceledDrag.current ? undefined : over ? `放到${ZONE_LABELS[over.data.current?.zone as Zone]}` : "移到主栏或展开栏",
          onDragEnd: () => "拖动结束", onDragCancel: () => "已取消拖动，布局未改变",
        },
      }}
      onDragStart={({ active: item }) => { canceledDrag.current = false; setKeyboardDrag(null); if (isEditorToolbarTool(item.id)) setActive(item.id); }}
      onDragMove={updateDropTarget} onDragOver={updateDropTarget}
      onDragEnd={({ active: item, over }) => {
        if (!canceledDrag.current && over && isEditorToolbarTool(item.id) && draftRef.current) commit(draftRef.current, item.id);
        setActive(null); changeDraft(null);
      }}
      onDragCancel={() => { setActive(null); changeDraft(null); }}
    >
      <div data-toolbar-preview-frame className="overflow-hidden rounded-[var(--radius-control)] border border-border bg-background">
        <div className="milkdown"><div className="milkdown-top-bar" role="toolbar" aria-label="主栏工具" data-toolbar-preview-primary>
          <DropZone zone="primary" active={Boolean(moving)}>
            {tools("primary")}
            {fitted.showMore ? <>
              {!previewCustom && fitted.dividers.includes("more") ? <span className="top-bar-divider" /> : null}
              <span ref={anchorRef} role="img" aria-label="更多，固定位置" data-toolbar-fixed-more><ToolGlyph tool="more" zone="primary" /></span>
            </> : null}
          </DropZone>
        </div></div>
        <div aria-hidden="true" className="h-40" />
        <div data-toolbar-preview-footer className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
          {!previewCustom ? <Tool tool="sticker" zone="more" index={fitted.more.length} total={fitted.more.length + 1} active={moving === "sticker"} footer /> : null}
        </div>
      </div>
      {moreAnchor || moving ? <Popover.Root open onOpenChange={(_, details) => details.cancel()}>
        <Popover.Portal>
          <Popover.Positioner anchor={moreAnchor ?? root} positionMethod="fixed" side="bottom" align="end" sideOffset={6} collisionPadding={8}
            className="z-[var(--layer-nested-popup)]" data-toolbar-preview-positioner>
            <Popover.Popup ref={morePopup} initialFocus={false} finalFocus={false}
              className="w-80 max-w-[var(--available-width)] outline-none" data-toolbar-preview-more>
              <DropZone zone="more" active={Boolean(moving)}>
                <div role="toolbar" aria-label="展开栏工具" className="flex min-h-10 flex-wrap gap-1">{tools("more")}</div>
              </DropZone>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root> : null}
      <DragOverlay style={{ pointerEvents: "none" }}>
        {active ? <div className={cn(iconClass, "milkdown cursor-grabbing bg-popover text-foreground shadow-popover ring-2 ring-primary")}
          style={{ transform: "scale(1.06)" }}><div className={fitted.primary.includes(active) ? "milkdown-top-bar" : undefined}><ToolGlyph tool={active} zone={fitted.primary.includes(active) ? "primary" : "more"} /></div></div> : null}
      </DragOverlay>
    </DndContext>
    <div role="status" className="sr-only" aria-live="polite">{announcement}</div>
  </div>;
}
