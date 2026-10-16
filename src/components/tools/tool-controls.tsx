"use client";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";
import { ToolCopyFeedback, useToolCopy } from "./tool-copy-feedback";

const subscribeReady = () => () => {};
export function useToolReady() {
  return useSyncExternalStore(subscribeReady, () => true, () => false);
}

export function ToolSelect({ label, value, onChange, options, disabled, embedded = false, previewLayout = "inline" }: {
  label: string; value: string; onChange: (value: string) => void;
  options: readonly { id: string; label: string; preview?: string }[]; disabled?: boolean; embedded?: boolean;
  previewLayout?: "inline" | "stacked";
}) {
  const id = useId();
  const selected = options.find((item) => item.id === value);
  const stacked = previewLayout === "stacked";
  const renderOption = (item: { label: string; preview?: string } | undefined) => stacked ?
    <span className="flex min-w-0 flex-col gap-1 text-left"><span>{item?.label}</span>{item?.preview && <span aria-hidden="true" className="break-all whitespace-normal py-1 leading-loose">{item.preview}</span>}</span> :
    <>{item?.label}{item?.preview && <span aria-hidden="true" className="ml-3">{item.preview}</span>}</>;
  return <div className="grid gap-2"><label htmlFor={id} className="text-sm font-normal">{label}</label>
    <Select value={value} onValueChange={(next) => { if (next) onChange(next); }} disabled={disabled}>
      <SelectTrigger id={id} className={cn("w-full min-w-0", stacked && "data-[size=default]:h-auto py-3 *:data-[slot=select-value]:line-clamp-none")}>
        <SelectValue className={cn("min-w-0", stacked ? "overflow-visible" : "truncate")}>{renderOption(selected)}</SelectValue>
      </SelectTrigger>
      <SelectContent>{options.map((item) => <SelectItem key={item.id} value={item.id}
        className={cn(embedded && "min-h-11 text-base", stacked && "py-3 [&>span:first-child]:min-w-0 [&>span:first-child]:shrink")}>
        {renderOption(item)}
      </SelectItem>)}</SelectContent>
    </Select>
  </div>;
}
export function ToolResult({ text, scrollStart, resultClassName, embedded = false, entries, hideHeading = false }: { text: string; hideHeading?: boolean; scrollStart?: "left" | "right"; resultClassName?: string; embedded?: boolean; entries?: readonly string[] }) {
  const { message, copy } = useToolCopy();
  const result = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (result.current && scrollStart) result.current.scrollLeft = scrollStart === "right" ? result.current.scrollWidth : 0;
  }, [text, scrollStart]);
  useEffect(() => {
    if (!embedded || !text || !panel.current) return;
    const bounds = panel.current.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
      panel.current.scrollIntoView?.({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [embedded, text]);
  if (embedded && !text) return null;
  return <section ref={panel} className="scroll-mt-3 grid gap-3 rounded-[var(--radius-card)] bg-card p-5 sm:p-6" aria-label="转换结果">
    <div className="flex flex-wrap items-center justify-between gap-3">{!hideHeading && <h2 className="text-base font-normal">生成结果</h2>}
      <Button type="button" variant="outline" disabled={!text} onClick={() => { void copy(text); }}>
        <WenyouIcon id="action.copy" />复制全部
      </Button>
    </div>
    {embedded && entries ? <ul className="divide-y divide-border">{entries.map((entry, index) => <li key={`${index}-${entry}`} className="flex min-w-0 items-center gap-2 py-1">
      <span className="min-w-0 flex-1 select-text break-words text-base">{entry}</span>
      <Button type="button" size="compact" variant="ghost" aria-label={`复制${entry}`} onClick={() => { void copy(entry); }}>复制</Button>
    </li>)}</ul> : <Textarea ref={result} aria-label="生成结果" value={text} readOnly rows={embedded ? 3 : 7} wrap={embedded && !scrollStart ? "soft" : "off"} className={cn("min-h-40 resize-y font-mono leading-relaxed", embedded && !scrollStart && "field-sizing-content min-h-24 max-h-64", resultClassName)} />}
    <ToolCopyFeedback message={message} />
  </section>;
}
