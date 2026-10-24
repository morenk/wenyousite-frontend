"use client";

import { useState, type PointerEvent } from "react";
import { EDITOR_TEXT_COLOR_PRESETS, EDITOR_TEXT_COLOR_PROFILE } from "@wenyousite/foundation/editor";
import { Button } from "@/components/ui/button";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeTextColor } from "@/lib/markdown-text-color";

export function rgbToHex(channels: readonly number[]) {
  return "#" + channels.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
}
export function hexToChannels(color: string) { return [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16)); }
function rgbToHsv(color: string) {
  const [r, g, b] = hexToChannels(color).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max === 0 ? 0 : d / max, max];
}
function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return rgbToHex([f(5), f(3), f(1)]);
}
export function readRecentTextColors(accountId?: string) {
  if (!accountId) return [];
  try {
    const values: unknown = JSON.parse(localStorage.getItem("wenyou:text-colors:" + accountId) ?? "[]");
    return Array.isArray(values) ? [...new Set(values.map(normalizeTextColor).filter((color): color is string => Boolean(color)))].slice(0, EDITOR_TEXT_COLOR_PROFILE.recent.maximum) : [];
  } catch { return []; }
}
function rememberTextColor(accountId: string | undefined, color: string) {
  if (!accountId) return;
  const values = [color, ...readRecentTextColors(accountId).filter((item) => item !== color)].slice(0, EDITOR_TEXT_COLOR_PROFILE.recent.maximum);
  try { localStorage.setItem("wenyou:text-colors:" + accountId, JSON.stringify(values)); } catch { /* 禁用存储不阻断正文编辑。 */ }
}

export interface EditorColorControls {
  enabled: boolean;
  color: string | null | undefined;
  accountId?: string;
  onApply: (color: string | null) => boolean;
  onCancel: () => void;
}
export function EditorTextColorPicker({ controls, onModeChange }: { controls: EditorColorControls; onModeChange: (custom: boolean) => void }) {
  const [custom, setCustom] = useState(false);
  const [color, setColor] = useState(controls.color ?? EDITOR_TEXT_COLOR_PRESETS[3]!.rgb);
  const [channels, setChannels] = useState(() => hexToChannels(color).map(String));
  const [hue, setHue] = useState(() => rgbToHsv(color)[0]);
  const [recent] = useState(() => readRecentTextColors(controls.accountId));
  const valid = channels.every((value) => /^\d{1,3}$/.test(value) && Number(value) <= 255);
  const [, saturation, value] = rgbToHsv(color);
  const update = (next: string, syncHue = true) => {
    setColor(next); setChannels(hexToChannels(next).map(String));
    if (syncHue) setHue(rgbToHsv(next)[0]);
  };
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.type === "pointermove" && !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (event.type === "pointerdown") event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = event.currentTarget.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const v = 1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    update(hsvToHex(hue, s, v), false);
  };
  if (custom) return <div className="grid w-72 gap-3 p-2">
    <div role="slider" tabIndex={0} aria-label="饱和度与亮度" aria-valuetext={Math.round(saturation * 100) + "%，" + Math.round(value * 100) + "%"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(saturation * 100)}
      onPointerDown={drag} onPointerMove={drag} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        update(hsvToHex(hue, Math.max(0, Math.min(1, saturation + (event.key === "ArrowLeft" ? -0.01 : event.key === "ArrowRight" ? 0.01 : 0))), Math.max(0, Math.min(1, value + (event.key === "ArrowDown" ? -0.01 : event.key === "ArrowUp" ? 0.01 : 0)))), false);
      }}
      className="relative h-36 touch-none cursor-crosshair rounded-[var(--radius-control)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ background: "linear-gradient(to top, hsl(0 0% 0%), transparent), linear-gradient(to right, hsl(0 0% 100%), transparent), hsl(" + hue + " 100% 50%)" }}>
      <span className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm" style={{ left: saturation * 100 + "%", top: (1 - value) * 100 + "%", backgroundColor: color }} />
    </div>
    <input aria-label="色相" type="range" min={0} max={359} value={hue} onChange={(event) => {
      const next = Number(event.target.value); setHue(next); update(hsvToHex(next, saturation, value), false);
    }} className="h-4 w-full cursor-pointer rounded-full accent-foreground" style={{ background: "linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))", appearance: "none" }} />
    <div className="grid grid-cols-3 gap-2">
      {["R", "G", "B"].map((label, index) => <label key={label} className="grid gap-1 text-xs text-muted-foreground">{label}<Input autoFocus={index === 0} aria-label={label} type="text" inputMode="numeric" maxLength={3} value={channels[index]} aria-invalid={!/^\d{1,3}$/.test(channels[index]!) || Number(channels[index]) > 255} className="h-9 px-2 text-center tabular-nums" onChange={(event) => {
        const next = channels.map((current, i) => i === index ? event.target.value : current); setChannels(next);
        if (next.every((channel) => /^\d{1,3}$/.test(channel) && Number(channel) <= 255)) { const hex = rgbToHex(next.map(Number)); setColor(hex); setHue(rgbToHsv(hex)[0]); }
      }} /></label>)}
    </div>
    {!valid && <p role="alert" className="text-xs text-destructive">请输入 0–255 整数</p>}
    <div className="flex h-11 items-center justify-center rounded-[var(--radius-control)] border border-border bg-background text-lg" style={{ color }}>文字预览 Aa</div>
    <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={controls.onCancel}>取消</Button><Button size="sm" disabled={!valid} onClick={() => { if (controls.onApply(color)) rememberTextColor(controls.accountId, color); }}>应用</Button></div>
  </div>;
  const swatch = (label: string, rgb: string | null, key: string) => <Button key={key} variant="ghost" size="icon-sm" disabled={!controls.enabled} aria-label={label} title={label} aria-pressed={controls.color !== undefined && controls.color === rgb} className={cn("size-8 shrink-0 rounded-[var(--radius-control)]", controls.color !== undefined && controls.color === rgb && "bg-accent ring-1 ring-ring/40")} onClick={() => { if (controls.onApply(rgb) && rgb && key === rgb) rememberTextColor(controls.accountId, rgb); }}>{rgb ? <span className="size-4 rounded-full border border-foreground/15" style={{ backgroundColor: rgb }} /> : <span className="flex size-5 items-center justify-center rounded-full border border-border bg-card"><WenyouIcon id="editor.text-color" className="size-4" /></span>}</Button>;
  return <div className="border-t border-border pt-1">
    <div className="flex items-center gap-0.5">
      {swatch("默认文字颜色", null, "default")}
      {EDITOR_TEXT_COLOR_PRESETS.map((preset) => swatch(preset.label, preset.rgb, preset.id))}
      <Button variant="ghost" size="sm" disabled={!controls.enabled} className="h-8 px-2" onClick={() => { setCustom(true); onModeChange(true); }}>自定义</Button>
    </div>
    {recent.length > 0 && <div aria-label="最近使用的颜色" className="mt-1 flex items-center gap-0.5">{recent.map((rgb) => swatch("最近颜色 " + rgb, rgb, rgb))}</div>}
  </div>;
}
