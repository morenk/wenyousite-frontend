"use client";

import { ArrowDown, ArrowUp, ArrowUpToLine } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fontLanguageLabels, type FontLanguage } from "@/lib/admin-text-font-upload";
import { getApiErrorMessage } from "@/api/errors";

export interface FontOrderItem { id: string; name: string; language: FontLanguage }
export function moveFontInLanguage(items: readonly FontOrderItem[], id: string, direction: "top" | "up" | "down") {
  const item = items.find((entry) => entry.id === id);
  if (!item) return [...items];
  const group = items.filter((entry) => entry.language === item.language);
  const index = group.findIndex((entry) => entry.id === id);
  const to = direction === "top" ? 0 : Math.max(0, Math.min(group.length - 1, index + (direction === "up" ? -1 : 1)));
  group.splice(index, 1); group.splice(to, 0, item);
  let cursor = 0;
  return items.map((entry) => entry.language === item.language ? group[cursor++]! : entry);
}
export function TextFontOrderEditor({ items, disabled = false, conflict = false, unconfirmed = false, onSave, onReload, onCancel }: {
  items: readonly FontOrderItem[]; disabled?: boolean; conflict?: boolean; unconfirmed?: boolean;
  onSave: (items: readonly FontOrderItem[]) => Promise<void>; onReload: () => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(items);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const changed = draft.some((item, index) => item.id !== items[index]?.id);
  const blocked = disabled || pending || conflict || unconfirmed;
  const move = (id: string, direction: "top" | "up" | "down") => {
    if (blocked) return;
    const next = moveFontInLanguage(draft, id, direction);
    setDraft(next);
    const entry = next.find((item) => item.id === id)!;
    setMessage(`${entry.name}，${fontLanguageLabels[entry.language]}第 ${next.filter((item) => item.language === entry.language).findIndex((item) => item.id === id) + 1} 位`);
  };
  return <section className="space-y-4" aria-label="调整展示顺序">
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="flex gap-2"><Button variant="outline" disabled={pending} onClick={onCancel}>取消</Button><Button disabled={blocked || !changed} onClick={async () => {
        if (lock.current || blocked || !changed) return;
        lock.current = true; setPending(true); setError("");
        try { await onSave(draft); } catch (reason) { setError(getApiErrorMessage(reason, "顺序未保存，请重试")); }
        finally { lock.current = false; setPending(false); }
      }}>{pending ? "正在保存…" : "保存顺序"}</Button></div>
    </div>
    {(conflict || unconfirmed) && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm"><span>{conflict ? "目录已更新，请读取最新顺序后重排。" : "保存结果未确认，请读取最新顺序。"}</span><Button size="compact" variant="outline" onClick={onReload}>读取最新顺序</Button></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="sr-only" role="status">{message}</p>
    {draft.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">暂无可选字体</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      {Object.entries(fontLanguageLabels).filter(([language]) => draft.some((item) => item.language === language)).map(([language, label]) => {
        const group = draft.filter((item) => item.language === language);
        return <section key={language} aria-label={`${label}展示顺序`} className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          <h3 className="border-b border-border px-4 py-3 text-sm font-semibold">{label}<span className="ml-2 font-utility font-normal text-muted-foreground">{group.length}</span></h3>
          <ol className="divide-y divide-border">{group.map((item, index) => <li key={item.id} tabIndex={0} aria-label={`${item.name}，第 ${index + 1} 位`} className="flex min-w-0 items-center gap-2 px-3 py-2" onKeyDown={(event) => {
            if (!event.altKey || !["ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
            event.preventDefault(); event.currentTarget.focus(); move(item.id, event.key === "Home" ? "top" : event.key === "ArrowUp" ? "up" : "down");
          }}>
            <span className="w-5 shrink-0 text-center font-utility text-xs text-muted-foreground">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
            <div className="flex shrink-0 gap-1">
              <Button size="icon-sm" variant="ghost" aria-label={`${item.name}置顶`} aria-keyshortcuts="Alt+Home" disabled={blocked || index === 0} onClick={() => move(item.id, "top")}><ArrowUpToLine /></Button>
              <Button size="icon-sm" variant="ghost" aria-label={`${item.name}上移`} aria-keyshortcuts="Alt+ArrowUp" disabled={blocked || index === 0} onClick={() => move(item.id, "up")}><ArrowUp /></Button>
              <Button size="icon-sm" variant="ghost" aria-label={`${item.name}下移`} aria-keyshortcuts="Alt+ArrowDown" disabled={blocked || index === group.length - 1} onClick={() => move(item.id, "down")}><ArrowDown /></Button>
            </div>
          </li>)}</ol>
        </section>;
      })}
    </div>
  </section>;
}
