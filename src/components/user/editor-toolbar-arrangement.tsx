"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin,
  useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragMoveEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronDown } from "lucide-react";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { EDITOR_CAPABILITY_LABELS } from "@/lib/editor-capabilities";
import { editorAlignmentIconId, editorIconId } from "@/lib/editor-icons";
import { type EditorToolbarTool, isEditorToolbarTool } from "@/lib/editor-toolbar-preference";
import { cn } from "@/lib/utils";

type Zone = "primary" | "more";
type Layout = Record<Zone, EditorToolbarTool[]>;
interface DropTarget { zone: Zone; index: number }
const ZONE_LABELS = { primary: "主栏", more: "展开栏" } as const;
const iconClass = "inline-flex h-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground";
const collisionDetection: CollisionDetection = (args) => {
  const collisions = pointerWithin(args);
  const tools = collisions.filter(({ id }) => {
    if (!String(id).startsWith("slot:")) return false;
    const zone = args.droppableContainers.find((container) => container.id === id)?.data.current?.zone;
    return collisions.some((collision) => collision.id === `zone:${zone}`);
  });
  return tools.length ? tools : collisions;
};

function ToolGlyph({ tool }: { tool: EditorToolbarTool }) {
  if (tool === "heading") return <span aria-hidden="true" className="flex items-center gap-1 px-2 text-sm font-medium">正文<ChevronDown className="size-3" /></span>;
  if (tool === "alignment") return <span aria-hidden="true" className="flex">
    <span className="flex size-10 items-center justify-center"><WenyouIcon id={editorAlignmentIconId("center")} className="size-[18px]" /></span>
    <span className="flex size-10 items-center justify-center"><WenyouIcon id={editorAlignmentIconId("right")} className="size-[18px]" /></span>
  </span>;
  return <span aria-hidden="true" className="flex size-10 items-center justify-center"><WenyouIcon id={editorIconId(tool)} className="size-[18px]" /></span>;
}

function Tool({ tool, zone, index, total, active, insertion }: {
  tool: EditorToolbarTool; zone: Zone; index: number; total: number;
  active: boolean; insertion?: "before" | "after";
}) {
  const positionId = useId();
  const { setNodeRef: setDragNodeRef, attributes, listeners } = useDraggable({ id: tool, data: { tool, zone } });
  const { setNodeRef: setDropNodeRef } = useDroppable({ id: `slot:${tool}`, data: { tool, zone, index } });
  return <div ref={setDropNodeRef} className="relative shrink-0">
    {insertion ? <span aria-hidden="true" data-toolbar-drop-marker className={cn("pointer-events-none absolute inset-y-0 z-10 w-0.5 rounded bg-primary", insertion === "before" ? "-left-1" : "-right-1")} /> : null}
    <button
      ref={setDragNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={EDITOR_CAPABILITY_LABELS[tool]}
      aria-describedby={`${attributes["aria-describedby"]} ${positionId}`}
      aria-roledescription={undefined}
      data-toolbar-arrange-tool={tool}
      title={EDITOR_CAPABILITY_LABELS[tool]}
      className={cn(iconClass, "cursor-grab select-none outline-none hover:bg-accent/60 hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40 active:cursor-grabbing",
        active && "opacity-25")}
    ><ToolGlyph tool={tool} /></button>
    <span id={positionId} className="sr-only">{ZONE_LABELS[zone]}，第 {index + 1} 项，共 {total} 项</span>
  </div>;
}

function PrimaryToolbarRail({ children, active, setDropRef }: {
  children: ReactNode; active: boolean; setDropRef: (node: HTMLElement | null) => void;
}) {
  const viewportId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const scrollDrag = useRef<{ x: number; left: number } | null>(null);
  const [scroll, setScroll] = useState({ left: 0, width: 0, total: 0 });
  const measure = useCallback(() => {
    const node = viewport.current;
    if (!node) return;
    const next = { left: node.scrollLeft, width: node.clientWidth, total: node.scrollWidth };
    setScroll((previous) => previous.left === next.left && previous.width === next.width && previous.total === next.total ? previous : next);
  }, []);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [measure]);
  const maximum = Math.max(0, scroll.total - scroll.width);
  const setScrollLeft = (value: number) => { if (viewport.current) viewport.current.scrollLeft = Math.max(0, Math.min(maximum, value)); };
  return <div className="min-w-0 flex-1">
    <div id={viewportId} ref={(node) => { viewport.current = node; setDropRef(node); }} data-toolbar-drop-zone="primary"
      onScroll={measure}
      className={cn("overflow-x-auto overscroll-x-contain p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", active && "bg-accent/30 ring-2 ring-primary/60 ring-inset")}
    >{children}</div>
    {maximum > 1 ? <div
      role="scrollbar" aria-label="主栏横向滚动" aria-controls={viewportId} aria-orientation="horizontal"
      aria-valuemin={0} aria-valuemax={Math.round(maximum)} aria-valuenow={Math.round(scroll.left)} tabIndex={0}
      data-toolbar-scrollbar
      className="relative mx-1 mb-1 h-1.5 touch-none cursor-pointer rounded-full bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      onPointerDown={(event) => {
        event.preventDefault();
        const track = event.currentTarget;
        track.focus();
        track.setPointerCapture(event.pointerId);
        const rect = track.getBoundingClientRect();
        const thumbLeft = scroll.left / scroll.total * rect.width;
        const thumbWidth = scroll.width / scroll.total * rect.width;
        const point = event.clientX - rect.left;
        const left = point < thumbLeft || point > thumbLeft + thumbWidth
          ? Math.max(0, Math.min(maximum, (point - thumbWidth / 2) / rect.width * scroll.total)) : scroll.left;
        setScrollLeft(left);
        scrollDrag.current = { x: event.clientX, left };
      }}
      onPointerMove={(event) => {
        if (!scrollDrag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        setScrollLeft(scrollDrag.current.left + (event.clientX - scrollDrag.current.x) / event.currentTarget.clientWidth * scroll.total);
      }}
      onPointerUp={(event) => { scrollDrag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
      onLostPointerCapture={() => { scrollDrag.current = null; }}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        setScrollLeft(event.key === "Home" ? 0 : event.key === "End" ? maximum : scroll.left + (event.key === "ArrowRight" ? 40 : -40));
      }}
    ><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 rounded-full bg-muted-foreground/50"
      style={{ width: `${scroll.width / scroll.total * 100}%`, left: `${scroll.left / scroll.total * 100}%` }} /></div> : null}
  </div>;
}

function DropZone({ zone, children, active }: { zone: Zone; children: ReactNode; active: boolean }) {
  const { setNodeRef } = useDroppable({ id: `zone:${zone}`, data: { zone } });
  if (zone === "primary") return <PrimaryToolbarRail setDropRef={setNodeRef} active={active}>{children}</PrimaryToolbarRail>;
  return <div ref={setNodeRef} data-toolbar-drop-zone={zone}
    className={cn("min-h-14 w-80 max-w-full rounded-[var(--radius-panel)] border border-border bg-popover p-2 shadow-popover",
      active && "bg-accent/30 ring-2 ring-primary/60 ring-inset")}
  >{children}</div>;
}

function targetFromEvent(event: DragMoveEvent | DragEndEvent): DropTarget | null {
  const data = event.over?.data.current;
  if (data?.zone !== "primary" && data?.zone !== "more") return null;
  if (!data.tool) return { zone: data.zone, index: Number.MAX_SAFE_INTEGER };
  const rect = event.active.rect.current.translated;
  const after = rect && event.over && rect.left + rect.width / 2 > event.over.rect.left + event.over.rect.width / 2;
  return { zone: data.zone, index: Number(data.index) + (after ? 1 : 0) };
}

export function EditorToolbarArrangement({ primary, more, onChange }: Layout & {
  onChange: (primary: EditorToolbarTool[], more: EditorToolbarTool[]) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const canceledDrag = useRef(false);
  const [keyboardDrag, setKeyboardDrag] = useState<(DropTarget & { tool: EditorToolbarTool }) | null>(null);
  const [active, setActive] = useState<EditorToolbarTool | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 5 } }),
  );
  const layout = { primary, more };

  const place = (tool: EditorToolbarTool, zone: Zone, index: number) => {
    const next = { primary: primary.filter((id) => id !== tool), more: more.filter((id) => id !== tool) };
    next[zone].splice(Math.min(Math.max(0, index), next[zone].length), 0, tool);
    if (next.primary.join() === primary.join() && next.more.join() === more.join()) return;
    onChange(next.primary, next.more);
    setAnnouncement(`${EDITOR_CAPABILITY_LABELS[tool]}已移到${ZONE_LABELS[zone]}第 ${next[zone].indexOf(tool) + 1} 项`);
  };
  const updateDropTarget = (event: DragMoveEvent) => { if (!canceledDrag.current) setDropTarget(targetFromEvent(event)); };
  const finishDrag = (event: DragEndEvent) => {
    const tool = event.active.id;
    const target = targetFromEvent(event);
    if (!canceledDrag.current && isEditorToolbarTool(tool) && target) {
      const previousIndex = layout[target.zone].indexOf(tool);
      const index = Math.min(target.index, layout[target.zone].length);
      place(tool, target.zone, index - (previousIndex !== -1 && previousIndex < index ? 1 : 0));
      requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-toolbar-arrange-tool="${tool}"]`)?.focus());
    }
    setActive(null);
    setDropTarget(null);
  };
  const navigateTools = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !isEditorToolbarTool(target.dataset.toolbarArrangeTool)) return;
    const tool = target.dataset.toolbarArrangeTool;
    const zone: Zone = primary.includes(tool) ? "primary" : "more";
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (keyboardDrag) {
        // 跨栏会替换图标节点，先把焦点留在弹窗内，避免焦点守卫抢回关闭按钮。
        root.current?.focus({ preventScroll: true });
        place(keyboardDrag.tool, keyboardDrag.zone, keyboardDrag.index);
        setKeyboardDrag(null);
        requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-toolbar-arrange-tool="${keyboardDrag.tool}"]`)?.focus());
      } else {
        setKeyboardDrag({ tool, zone, index: layout[zone].indexOf(tool) });
        setAnnouncement(`已提起${EDITOR_CAPABILITY_LABELS[tool]}，左右键排序，上下键切换栏，空格放下，Escape 取消`);
      }
      return;
    }
    if (keyboardDrag) {
      if (event.key === "Tab") {
        setKeyboardDrag(null);
        setAnnouncement("已取消拖动，布局未改变");
        return;
      }
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = { ...keyboardDrag };
      if (event.key === "ArrowUp") next.zone = "primary";
      if (event.key === "ArrowDown") next.zone = "more";
      const items = layout[next.zone].filter((id) => id !== next.tool);
      const maximum = items.length;
      if (event.key === "ArrowLeft") next.index--;
      if (event.key === "ArrowRight") next.index++;
      if (event.key === "Home") next.index = 0;
      if (event.key === "End") next.index = maximum;
      next.index = Math.min(Math.max(next.index, 0), maximum);
      setKeyboardDrag(next);
      setAnnouncement(`${EDITOR_CAPABILITY_LABELS[next.tool]}，${ZONE_LABELS[next.zone]}第 ${next.index + 1} 项，空格放下`);
      const neighbor = items[Math.min(next.index, maximum - 1)];
      if (neighbor) root.current?.querySelector<HTMLElement>(`[data-toolbar-arrange-tool="${neighbor}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-toolbar-arrange-tool]"));
    const index = buttons.indexOf(target);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next]?.focus({ preventScroll: true });
    buttons[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const marker = keyboardDrag ? {
    zone: keyboardDrag.zone,
    index: keyboardDrag.index + (layout[keyboardDrag.zone].indexOf(keyboardDrag.tool) !== -1
      && layout[keyboardDrag.zone].indexOf(keyboardDrag.tool) < keyboardDrag.index ? 1 : 0),
  } : dropTarget;
  const tools = (zone: Zone) => layout[zone].map((tool, index) => <Tool
    key={tool} tool={tool} zone={zone} index={index} total={layout[zone].length}
    active={active === tool || keyboardDrag?.tool === tool}
    insertion={marker?.zone === zone ? marker.index === index ? "before"
      : index === layout[zone].length - 1 && marker.index > index ? "after" : undefined : undefined}
  />);

  // 弹窗先拦截 Escape；立即停止落点和自动滚动，释放指针后由 cancelDrop 结束传感器。
  useEffect(() => {
    if (!active && !keyboardDrag) return;
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      canceledDrag.current = true;
      setActive(null);
      setKeyboardDrag(null);
      setDropTarget(null);
      setAnnouncement("已取消拖动，布局未改变");
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, [active, keyboardDrag]);

  return <div ref={root} tabIndex={-1} className="outline-none">
    <p className="mb-4 text-xs text-muted-foreground">拖动图标（触屏长按）</p>
    <DndContext sensors={sensors} collisionDetection={collisionDetection} autoScroll={active !== null} cancelDrop={() => canceledDrag.current}
      accessibility={{
        screenReaderInstructions: { draggable: "空格或 Enter 提起及放下工具，左右键调整位置，上下键切换主栏和展开栏，Escape 取消。" },
        announcements: {
          onDragStart: ({ active: item }) => `正在移动${EDITOR_CAPABILITY_LABELS[item.id as EditorToolbarTool]}`,
          onDragOver: ({ over }) => canceledDrag.current ? undefined : over ? `放到${ZONE_LABELS[over.data.current?.zone as Zone]}` : "移到主栏或展开栏",
          onDragEnd: () => "拖动结束",
          onDragCancel: () => "已取消拖动，布局未改变",
        },
      }}
      onDragStart={({ active: item }) => { canceledDrag.current = false; setKeyboardDrag(null); if (isEditorToolbarTool(item.id)) setActive(item.id); }}
      onDragMove={updateDropTarget}
      onDragOver={updateDropTarget}
      onDragEnd={finishDrag}
      onDragCancel={() => { setActive(null); setDropTarget(null); }}
    >
      <section aria-label="主栏">
        <h3 className="mb-2 text-sm font-semibold">主栏</h3>
        <div className="flex min-w-0 items-center rounded-[var(--radius-panel)] border border-border bg-background">
          <DropZone zone="primary" active={marker?.zone === "primary"}>
            <div role="toolbar" aria-label="主栏工具" onKeyDown={navigateTools} className="flex min-h-10 w-max min-w-full items-center gap-1">
              {tools("primary")}
              {!primary.length ? <span className="px-3 text-xs text-muted-foreground">拖到这里</span> : null}
            </div>
          </DropZone>
          <span role="img" aria-label="更多，固定位置" title="更多（固定）" className={cn(iconClass, "mx-1 size-10 border-l border-border")}><WenyouIcon id={editorIconId("more")} className="size-[18px]" /></span>
        </div>
      </section>
      <section aria-label="展开栏" className="mt-5 ml-auto w-80 max-w-full">
        <h3 className="mb-2 text-sm font-semibold">展开栏</h3>
        <DropZone zone="more" active={marker?.zone === "more"}>
          <div role="toolbar" aria-label="展开栏工具" onKeyDown={navigateTools} className="flex min-h-10 flex-wrap items-center gap-1">
            {tools("more")}
            {!more.length ? <span className="px-2 text-xs text-muted-foreground">拖到这里</span> : null}
          </div>
        </DropZone>
      </section>
      <DragOverlay dropAnimation={null}>
        {active ? <div className={cn(iconClass, "cursor-grabbing bg-popover text-foreground shadow-popover ring-2 ring-primary")}><ToolGlyph tool={active} /></div> : null}
      </DragOverlay>
    </DndContext>
    <div role="status" className="sr-only" aria-live="polite">{announcement}</div>
  </div>;
}
