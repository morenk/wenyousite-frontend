"use client";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { dynamicTextFontRuntime, type FontDownloadSnapshot } from "@/lib/dynamic-text-font-runtime";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { formatBytes } from "@/components/shared/image-upload-progress";

export interface EditorFontDownloadHandle { start: (id: string | null, name?: string) => void }
/** 单独订阅传输，不让 chunk 更新正文、选区或阅读锚点；最多每100ms绘制一次。 */
export function EditorFontDownloadProgress({ ref, scope }: { ref?: Ref<EditorFontDownloadHandle>; scope: symbol }) {
  const [visible, setVisible] = useState<(FontDownloadSnapshot & { name: string }) | null>(null);
  const release = useRef<() => void>(() => {});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<(FontDownloadSnapshot & { name: string }) | null>(null);
  const shown = useRef(false);
  const generation = useRef(0);
  const clear = () => {
    generation.current++; release.current(); release.current = () => {};
    clearTimeout(timer.current); timer.current = undefined; pending.current = null; shown.current = false;
    setVisible(null);
  };
  useImperativeHandle(ref, () => ({ start: (id, name = "") => {
    clear();
    if (!id) return;
    const current = generation.current;
    release.current = dynamicTextFontRuntime().subscribeDownload(id, scope, value => {
      if (current !== generation.current) return;
      if (value.status === "ready") { clear(); return; }
      pending.current = { ...value, name };
      if (timer.current !== undefined) return;
      timer.current = setTimeout(() => {
        timer.current = undefined;
        if (current !== generation.current) return;
        shown.current = true; setVisible(pending.current);
      }, shown.current ? 100 : 250);
    });
  }}));
  useEffect(() => () => { generation.current++; release.current(); clearTimeout(timer.current); }, []);
  if (!visible) return null;
  const failed = visible.status === "fallback";
  const label = failed ? "暂用系统字体" : visible.phase === "preparing" ? "准备字体" : visible.phase === "applying" ? "正在应用字体" : "下载字体";
  const percent = !failed && visible.phase === "downloading" && visible.totalBytes !== null && visible.totalBytes > 0 ? visible.receivedBytes / visible.totalBytes * 100 : null;
  const bytes = visible.totalBytes === null ? `${formatBytes(visible.receivedBytes)} 已接收` : `${formatBytes(visible.receivedBytes)} / ${formatBytes(visible.totalBytes)}`;
  return <div data-slot="editor-font-download" className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
    <div className="flex min-w-0 items-center gap-2">
      <span role="status" className="min-w-0 flex-1 truncate">{label}{visible.name ? ` · ${visible.name}` : ""}</span>
      {!failed && (visible.phase !== "preparing" || visible.receivedBytes > 0) && <span className="shrink-0 font-utility tabular-nums">{bytes}</span>}
      <Button variant="ghost" size="icon-sm" aria-label="收起字体下载状态" className="size-6" onClick={clear}><WenyouIcon id="action.close" className="size-3.5" /></Button>
    </div>
    {!failed && <Progress className="mt-1" trackClassName="h-1" value={percent} aria-label={label} aria-valuetext={percent === null ? bytes : `${Math.floor(percent)}%，${bytes}`} />}
  </div>;
}
