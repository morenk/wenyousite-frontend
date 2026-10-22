"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

/** 纯界面选项；正式目录由契约适配层验证后传入，不在这里定义字体 ID、CSS 或 URL。 */
export interface EditorFontOption {
  value: string;
  label: string;
  /** 由契约适配层提供显示分组；选择器不推断语言或字符覆盖。 */
  group?: string;
}

export interface EditorFontControls {
  options: readonly EditorFontOption[];
  value: string | null | undefined;
  enabled: boolean;
  accountId?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onOpen?: () => void;
  previewMode?: "automatic" | "on-demand";
  renderThumbnail?: (option: EditorFontOption) => ReactNode;
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

/** T 菜单内的字体面板；动态目录直接应用，旧协议保留显式预览与确认。 */
export function EditorTextFontPicker({ controls }: { controls: EditorFontControls }) {
  return controls.previewMode === "automatic" ? <FontSpecimenList controls={controls} /> : <LegacyFontPicker controls={controls} />;
}

function LegacyFontPicker({ controls }: { controls: EditorFontControls }) {
  const [selected, setSelected] = useState(controls.value);
  const [preview, setPreview] = useState<{ value: string; content: ReactNode } | null>(null);
  const [applyFailed, setApplyFailed] = useState(false);
  const option = controls.options.find((item) => item.value === selected);
  const automaticPreview = controls.previewMode === "automatic";
  const previewContent = option && automaticPreview ? controls.renderPreview(option) : preview?.value === option?.value ? preview?.content : null;
  const recent = readRecentTextFonts(controls.accountId, controls.options);
  const disabled = !controls.enabled;
  const catalogUnavailable = Boolean(controls.loading || controls.error);
  const choose = (value: number | null) => {
    if (value === null) return;
    const next = value === -1 ? null : controls.options[value]?.value;
    if (next === undefined || (next !== null && catalogUnavailable)) return;
    setSelected(next);
    setPreview(null);
    setApplyFailed(false);
  };
  const item = (entry: EditorFontOption) => <SelectItem key={entry.value} value={controls.options.indexOf(entry)} disabled={catalogUnavailable} label={entry.label} className="[&>span:first-child]:min-w-0 [&>span:first-child]:shrink">
    {controls.renderThumbnail ? <span className="grid min-w-0 flex-1 gap-1"><span className="whitespace-normal break-words">{entry.label}</span>{controls.renderThumbnail(entry)}</span> : entry.label}
  </SelectItem>;
  const recentOptions = recent.flatMap((value) => controls.options.filter((entry) => entry.value === value));
  const otherOptions = controls.options.filter((entry) => !recent.includes(entry.value));
  const groups = new Map<string, EditorFontOption[]>();
  for (const entry of otherOptions) {
    const label = entry.group ?? (recentOptions.length > 0 ? "全部字体" : "");
    const entries = groups.get(label) ?? [];
    entries.push(entry);
    groups.set(label, entries);
  }
  return <div className="grid w-72 max-w-full gap-3 p-2">
    <Select value={selected === null ? -1 : option ? controls.options.indexOf(option) : null} onValueChange={choose} onOpenChange={open=>{if(open)controls.onOpen?.();}} disabled={disabled}>
      <SelectTrigger aria-label="字体" size="sm" className="w-full"><SelectValue placeholder={selected === undefined ? "混合字体" : "选择字体"}>{selected === null ? "系统默认" : option?.label}</SelectValue></SelectTrigger>
      <SelectContent layer="nested" alignItemWithTrigger={false} className="max-h-80">
        <SelectItem value={-1}>系统默认</SelectItem>
        {recentOptions.length > 0 && <SelectGroup><SelectLabel>最近使用</SelectLabel>{recentOptions.map(item)}</SelectGroup>}
        {Array.from(groups, ([label, entries]) => <SelectGroup key={label}>{label && <SelectLabel>{label}</SelectLabel>}{entries.map(item)}</SelectGroup>)}
      </SelectContent>
    </Select>
    {controls.loading && <p role="status" className="text-xs text-muted-foreground">正在加载字体列表…</p>}
    {controls.error && <div className="flex items-center justify-between gap-2"><p role="alert" className="text-xs text-destructive">{controls.error}</p>{controls.onRetry && <Button variant="ghost" size="sm" onClick={controls.onRetry}>重试</Button>}</div>}
    {!controls.loading && !controls.error && controls.options.length === 0 && <p role="status" className="text-xs text-muted-foreground">暂无可用字体</p>}
    {previewContent && <div aria-label="字体预览" className="flex h-24 items-center overflow-auto rounded-[var(--radius-control)] border border-border bg-background p-3">{previewContent}</div>}
    {applyFailed && <p role="alert" className="text-xs text-destructive">未能应用字体，请重新选择正文</p>}
    <div className="flex items-center justify-between gap-2">
      {!automaticPreview && <Button variant="ghost" size="sm" disabled={disabled || catalogUnavailable || !option} onClick={() => {
        if (option) setPreview({ value: option.value, content: controls.renderPreview(option) });
      }}>预览</Button>}
      <div className="ml-auto flex gap-2"><Button variant="ghost" size="sm" onClick={controls.onCancel}>取消</Button><Button size="sm" disabled={disabled || (selected !== null && (catalogUnavailable || !option))} onClick={() => {
        if (disabled || (selected !== null && (catalogUnavailable || !option))) return;
        if (!controls.onApply(selected ?? null)) { setApplyFailed(true); return; }
        setApplyFailed(false);
        if (option) rememberTextFont(controls.accountId, option.value, controls.options);
      }}>应用</Button></div>
    </div>
  </div>;
}


const fontLanguages = ["中文", "日文", "英文"];
const optionLanguage = (option: EditorFontOption) => fontLanguages.includes(option.group ?? "") ? option.group! : "其他";

/** 动态目录直接选择并返回正文；列表只展示可见 PNG，不安装字库。 */
function FontSpecimenList({ controls }: { controls: EditorFontControls }) {
  const current = controls.options.find(option => option.value === controls.value);
  const [language, setLanguage] = useState(current ? optionLanguage(current) : "中文");
  const [failed, setFailed] = useState(false);
  const userChoseLanguage = useRef(false);
  useEffect(() => {
    if (current && !userChoseLanguage.current) setLanguage(optionLanguage(current));
  }, [current]);
  useEffect(() => { controls.onOpen?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 每次打开面板复核一次目录
  const languages = controls.options.some(option => optionLanguage(option) === "其他") ? [...fontLanguages, "其他"] : fontLanguages;
  const apply = (value: string | null) => {
    if (!controls.enabled || (value !== null && (controls.loading || controls.error))) return;
    const applied = controls.onApply(value);
    setFailed(!applied);
    if (applied && value) rememberTextFont(controls.accountId, value, controls.options);
  };
  return <div className="flex min-h-0 max-h-[calc(var(--available-height)-0.5rem)] w-96 max-w-[min(calc(100vw-2rem),calc(var(--available-width)-0.5rem))] flex-col overflow-hidden">
    <div className="flex shrink-0 items-center justify-between px-4 py-2">
      <span className="mr-auto text-sm font-semibold">字体</span>
      <Button variant="ghost" size="compact" disabled={!controls.enabled} aria-pressed={controls.value === null} onClick={() => apply(null)} className="mr-1 gap-1.5 px-2 text-xs text-muted-foreground">系统默认{controls.value === null && <WenyouIcon id="action.confirm" className="size-3.5" />}</Button>
      <Button variant="ghost" size="icon-sm" aria-label="关闭字体面板" onClick={controls.onCancel}><WenyouIcon id="action.close" className="size-4" /></Button>
    </div>
    <Tabs value={language} onValueChange={value => { userChoseLanguage.current = true; setLanguage(String(value)); }} className="min-h-0 gap-0">
      <TabsList aria-label="字体语言" className="mx-3 mb-2 w-auto shrink-0">{languages.map(label => <TabsTrigger key={label} value={label} className="px-3">{label}</TabsTrigger>)}</TabsList>
      {controls.value === undefined && <p className="px-4 pb-2 text-xs text-muted-foreground">选区包含多种字体</p>}
      {controls.value && !current && !controls.loading && <p className="px-4 pb-2 text-xs text-muted-foreground">当前字体已不在可选列表中</p>}
      {controls.loading && <p role="status" className="px-4 py-2 text-xs text-muted-foreground">正在加载字体列表…</p>}
      {controls.error && <div className="flex items-center justify-between gap-2 px-4 py-2"><p role="alert" className="text-xs text-destructive">{controls.error}</p>{controls.onRetry && <Button variant="ghost" size="sm" onClick={controls.onRetry}>重试</Button>}</div>}
      {failed && <p role="alert" className="px-4 py-2 text-xs text-destructive">未能应用字体，请重新选择正文</p>}
      {languages.map(label => <TabsContent key={label} value={label} className="max-h-[min(28rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain border-t border-border p-2">
        <div className="grid gap-0.5" aria-label={`${label}字体`} onKeyDown={event => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          if (!buttons.length) return;
          const at = buttons.indexOf(event.target as HTMLButtonElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (at + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
          event.preventDefault(); buttons[next]?.focus();
        }}>
          {controls.options.filter(option => optionLanguage(option) === label).map(option => <Button key={option.value} variant="ghost" disabled={!controls.enabled || Boolean(controls.loading || controls.error)} aria-label={option.label} aria-pressed={controls.value === option.value} onClick={() => apply(option.value)} className={cn("h-auto min-h-16 w-full flex-col items-stretch gap-0.5 whitespace-normal border border-transparent px-3 py-1.5 text-left", controls.value === option.value && "border-brand-strong/60 bg-accent/40")}>
            {controls.renderThumbnail?.(option)}
            <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span className="min-w-0 break-words">{option.label}</span>{controls.value === option.value && <WenyouIcon id="action.confirm" className="size-3.5 shrink-0 text-foreground" />}</span>
          </Button>)}
          {!controls.loading && !controls.error && !controls.options.some(option => optionLanguage(option) === label) && <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">暂无可用字体</p>}
        </div>
      </TabsContent>)}
    </Tabs>
  </div>;
}
