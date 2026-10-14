"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ToolCopyFeedback, useToolCopy } from "./tool-copy-feedback";
import type { NameEntry } from "@/lib/tools/names";

export function NameResults({ entries, embedded }: { entries: NameEntry[]; embedded: boolean }) {
  const { message, copy } = useToolCopy();
  const panel = useRef<HTMLElement>(null);
  const both = (item: NameEntry) => item.original === item.zh ? item.original : item.original + "（" + item.zh + "）";
  useEffect(() => {
    if (!embedded || !panel.current) return;
    const bounds = panel.current.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
      panel.current.scrollIntoView?.({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [embedded, entries]);
  return <section ref={panel} aria-label="姓名结果" className="scroll-mt-3 grid gap-3 rounded-[var(--radius-card)] bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => { void copy(entries.map((item) => item.zh).join("\n")); }}>复制中文</Button>
        <Button type="button" variant="outline" onClick={() => { void copy(entries.map((item) => item.original).join("\n")); }}>复制原文</Button>
        <Button type="button" variant="outline" onClick={() => { void copy(entries.map(both).join("\n")); }}>复制全部</Button>
      </div>
    </div>
    <ul className="divide-y divide-border">{entries.map((item) => <li key={item.original} className="flex min-w-0 items-center gap-2 py-3">
      <div className="min-w-0 flex-1 select-text break-words"><div className="text-base">{item.original}</div><div className="mt-1 text-sm text-muted-foreground">{item.zh}</div></div>
      <Button type="button" variant="ghost" size="compact" aria-label={"复制" + item.original} onClick={() => { void copy(both(item)); }}>复制</Button>
    </li>)}</ul>
    <ToolCopyFeedback message={message} />
  </section>;
}
