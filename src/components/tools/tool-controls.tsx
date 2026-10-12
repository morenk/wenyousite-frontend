"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";
import { copyToolText } from "@/lib/tools/clipboard";

export function ToolSelect({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (value: string) => void;
  options: readonly { id: string; label: string }[]; disabled?: boolean;
}) {
  const id = useId();
  return <div className="grid gap-2"><label htmlFor={id} className="text-sm font-medium">{label}</label>
    <Select value={value} onValueChange={(next) => { if (next) onChange(next); }} disabled={disabled}>
      <SelectTrigger id={id} className="w-full min-w-0"><SelectValue className="min-w-0 truncate">{options.find((item) => item.id === value)?.label}</SelectValue></SelectTrigger>
      <SelectContent>{options.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}
export function ToolResult({ text, onDownload, scrollStart, resultClassName }: { text: string; onDownload?: () => void; scrollStart?: "left" | "right"; resultClassName?: string }) {
  const [message, setMessage] = useState("");
  const result = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (result.current && scrollStart) result.current.scrollLeft = scrollStart === "right" ? result.current.scrollWidth : 0;
  }, [text, scrollStart]);
  return <section className="grid gap-3 rounded-[var(--radius-card)] bg-card p-5 sm:p-6" aria-label="转换结果">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">生成结果</h2>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!text} onClick={async () => setMessage(await copyToolText(text) ? "已复制" : "复制未成功，请长按或选中结果手动复制")}>
        <WenyouIcon id="action.copy" />复制全部
      </Button>
      {onDownload && <Button type="button" variant="outline" disabled={!text} onClick={onDownload}>下载结果</Button>}</div>
    </div>
    <Textarea ref={result} aria-label="生成结果" value={text} readOnly rows={7} wrap="off" className={cn("min-h-40 resize-y font-mono leading-relaxed", resultClassName)} />
    <p role="status" className={cn("text-sm text-muted-foreground", !message && "sr-only")}>{message}</p>
  </section>;
}
