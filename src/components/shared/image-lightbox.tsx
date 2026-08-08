/** ImageLightbox：查看原图的遮罩，支持滚轮/单击切换 1:1 缩放与拖拽平移 */

"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import { Maximize, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

/** 拖拽超过该像素距离视为平移而非单击 */
const DRAG_THRESHOLD = 5;
/** 每次滚轮/按钮缩放的倍率 */
const ZOOM_STEP = 1.25;

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === "undefined" ? 0 : window.innerWidth,
    h: typeof window === "undefined" ? 0 : window.innerHeight,
  }));
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const movedRef = useRef(false);

  // 原图适配视口的整体缩放比例（小图不放大，natural 未知或加载失败时视为 1）
  const fitScale =
    natural && viewport.w > 0 && viewport.h > 0
      ? Math.min(1, viewport.w / natural.w, viewport.h / natural.h)
      : 1;
  /** 1:1 时的整体缩放比例，同时也是放大上限（小图不放大） */
  const maxScale = fitScale > 0 ? 1 / fitScale : 1;
  const clampScale = (s: number) => Math.min(maxScale, Math.max(1, s));
  const percent = Math.round(view.scale * fitScale * 100);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    function handleResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 原生非 passive 滚轮监听，才能 preventDefault 阻止页面滚动
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const wheelTarget = el;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      if (!natural) return;
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const rect = wheelTarget.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      setView((v) => {
        const nextScale = clampScale(v.scale * factor);
        if (nextScale === v.scale) return v;
        return {
          scale: nextScale,
          x: cursorX - cx - ((cursorX - cx - v.x) / v.scale) * nextScale,
          y: cursorY - cy - ((cursorY - cy - v.y) / v.scale) * nextScale,
        };
      });
    }
    wheelTarget.addEventListener("wheel", handleWheel, { passive: false });
    return () => wheelTarget.removeEventListener("wheel", handleWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural]);

  function handleImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const w = e.currentTarget.naturalWidth;
    const h = e.currentTarget.naturalHeight;
    setNatural(w > 0 && h > 0 ? { w, h } : null);
    setView({ scale: 1, x: 0, y: 0 });
  }

  function toggleZoom() {
    setView((v) => {
      if (maxScale <= 1.001 || v.scale > 1.001) return { scale: 1, x: 0, y: 0 };
      return { scale: maxScale, x: v.x, y: v.y };
    });
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLImageElement>) {
    if (view.scale <= 1.001) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: view.x,
      offsetY: view.y,
    };
    movedRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLImageElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      movedRef.current = true;
    }
    if (movedRef.current) {
      setView((v) => ({ ...v, x: drag.offsetX + dx, y: drag.offsetY + dy }));
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleImageClick(e: ReactMouseEvent<HTMLImageElement>) {
    // 图片上的缩放点击不能继续触发遮罩关闭。
    e.stopPropagation();
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    toggleZoom();
  }

  const zoomed = view.scale > 1.001;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex select-none items-center justify-center overflow-hidden bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="查看原图"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- lightbox 直接展示 COS 原图，transform 缩放 */}
      <img
        src={src}
        alt={alt ?? ""}
        draggable={false}
        className="rounded-lg"
        style={
          natural
            ? {
                // 以自然像素作为 transform 的尺寸基准，避免 prose/preflight 的
                // max-width: 100% 先缩小一次后又被 fitScale 重复缩小。
                width: natural.w,
                height: natural.h,
                maxWidth: "none",
                maxHeight: "none",
                margin: 0,
                flexShrink: 0,
                transform: `translate(${view.x}px, ${view.y}px) scale(${(view.scale * fitScale).toFixed(6)})`,
                transformOrigin: "center",
                cursor: zoomed ? "grab" : "zoom-in",
              }
            : { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }
        }
        onLoad={handleImageLoad}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleImageClick}
      />

      {/* 工具条 */}
      <div
        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label="缩小"
          onClick={() => setView((v) => ({ ...v, scale: clampScale(v.scale / ZOOM_STEP) }))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <button
          type="button"
          className="min-w-12 px-1 text-center text-xs tabular-nums hover:text-brand-strong"
          onClick={toggleZoom}
          aria-label="切换 1:1 显示"
        >
          {percent}%
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label="放大"
          onClick={() => setView((v) => ({ ...v, scale: clampScale(v.scale * ZOOM_STEP) }))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label="1:1 原图"
          onClick={() => setView((v) => ({ scale: maxScale, x: v.x, y: v.y }))}
        >
          <span className="text-xs font-medium">1:1</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label="适应屏幕"
          onClick={() => setView({ scale: 1, x: 0, y: 0 })}
        >
          <Maximize className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-white/20" />
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label="关闭"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
