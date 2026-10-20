"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

/** 纯界面选项；正式目录由契约适配层验证后传入，不在这里定义字体 ID、CSS 或 URL。 */
export interface EditorFontOption {
  value: string;
  label: string;
}

export interface EditorFontControls {
  options: readonly EditorFontOption[];
  value: string | null | undefined;
  enabled: boolean;
  accountId?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onApply: (value: string | null) => boolean;
  onCancel: () => void;
  renderPreview: (option: EditorFontOption) => ReactNode;
}

const recentLimit = 4;

export function readRecentTextFonts(accountId: string | undefined, options: readonly EditorFontOption[]): string[] {
  if (!accountId) return [];
  try {
    const stored: unknown = JSON.parse(localStorage.getItem("wenyou:text-fonts:" + accountId) ?? "[]");
    if (!Array.isArray(stored)) return [];
    const allowed = new Set(options.map((option) => option.value));
    return [...new Set(stored.filter((value): value is string => typeof value === "string" && allowed.has(value)))].slice(0, recentLimit);
  } catch { return []; }
}

function rememberTextFont(accountId: string | undefined, value: string, options: readonly EditorFontOption[]) {
  if (!accountId) return;
  const recent = [value, ...readRecentTextFonts(accountId, options).filter((item) => item !== value)].slice(0, recentLimit);
  try { localStorage.setItem("wenyou:text-fonts:" + accountId, JSON.stringify(recent)); } catch { /* 本机偏好不可写不影响正文。 */ }
}

/** 供正文样式菜单挂载；选择与预览均不修改正文，仅“应用”调用宿主命令。 */
export function EditorTextFontPicker({ controls }: { controls: EditorFontControls }) {
  const [selected, setSelected] = useState(controls.value);
  const [preview, setPreview] = useState<{ value: string; content: ReactNode } | null>(null);
  const [applyFailed, setApplyFailed] = useState(false);
  const option = controls.options.find((item) => item.value === selected);
  const recent = readRecentTextFonts(controls.accountId, controls.options);
  const disabled = !controls.enabled || Boolean(controls.loading || controls.error);
  const choose = (value: number | null) => {
    if (value === null) return;
    const next = value === -1 ? null : controls.options[value]?.value;
    if (next === undefined) return;
    setSelected(next);
    setPreview(null);
    setApplyFailed(false);
  };
  const item = (entry: EditorFontOption) => <SelectItem key={entry.value} value={controls.options.indexOf(entry)}>{entry.label}</SelectItem>;
  const recentOptions = recent.flatMap((value) => controls.options.filter((entry) => entry.value === value));
  const otherOptions = controls.options.filter((entry) => !recent.includes(entry.value));
  return <div className="grid w-72 max-w-full gap-3 p-2">
    <Select value={selected === null ? -1 : option ? controls.options.indexOf(option) : null} onValueChange={choose} disabled={disabled}>
      <SelectTrigger aria-label="字体" size="sm" className="w-full"><SelectValue placeholder={selected === undefined ? "混合字体" : "选择字体"}>{selected === null ? "系统默认" : option?.label}</SelectValue></SelectTrigger>
      <SelectContent layer="nested" alignItemWithTrigger={false} className="max-h-64">
        <SelectItem value={-1}>系统默认</SelectItem>
        {recentOptions.length > 0 && <SelectGroup><SelectLabel>最近使用</SelectLabel>{recentOptions.map(item)}</SelectGroup>}
        {otherOptions.length > 0 && <SelectGroup>{recentOptions.length > 0 && <SelectLabel>全部字体</SelectLabel>}{otherOptions.map(item)}</SelectGroup>}
      </SelectContent>
    </Select>
    {controls.loading && <p role="status" className="text-xs text-muted-foreground">正在加载字体列表…</p>}
    {controls.error && <div className="flex items-center justify-between gap-2"><p role="alert" className="text-xs text-destructive">{controls.error}</p>{controls.onRetry && <Button variant="ghost" size="sm" onClick={controls.onRetry}>重试</Button>}</div>}
    {!controls.loading && !controls.error && controls.options.length === 0 && <p role="status" className="text-xs text-muted-foreground">暂无可用字体</p>}
    {preview && preview.value === option?.value && <div aria-label="字体预览" className="flex h-24 items-center overflow-auto rounded-[var(--radius-control)] border border-border bg-background p-3">{preview.content}</div>}
    {applyFailed && <p role="alert" className="text-xs text-destructive">未能应用字体，请重新选择正文</p>}
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="sm" disabled={disabled || !option} onClick={() => {
        if (option) setPreview({ value: option.value, content: controls.renderPreview(option) });
      }}>预览</Button>
      <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={controls.onCancel}>取消</Button><Button size="sm" disabled={disabled || (selected !== null && !option)} onClick={() => {
        if (disabled || (selected !== null && !option)) return;
        if (!controls.onApply(selected ?? null)) { setApplyFailed(true); return; }
        setApplyFailed(false);
        if (option) rememberTextFont(controls.accountId, option.value, controls.options);
      }}>应用</Button></div>
    </div>
  </div>;
}
