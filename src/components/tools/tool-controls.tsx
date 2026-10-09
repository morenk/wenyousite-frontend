"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { copyToolText } from "@/lib/tools/clipboard";

export function ToolSelect({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (value: string) => void;
  options: readonly { id: string; label: string }[]; disabled?: boolean;
}) {
  const id = useId();
  return <div className="grid gap-2"><label htmlFor={id} className="text-sm font-medium">{label}</label>
    <Select value={value} onValueChange={(next) => { if (next) onChange(next); }} disabled={disabled}>
      <SelectTrigger id={id} className="w-full"><SelectValue>{options.find((item) => item.id === value)?.label}</SelectValue></SelectTrigger>
      <SelectContent>{options.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}
export function ToolResult({ text }: { text: string }) {
  const [message, setMessage] = useState("");
  return <section className="grid gap-3 border-t border-border pt-5" aria-label="转换结果">
    <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">生成结果</h2>
      <Button type="button" variant="outline" disabled={!text} onClick={async () => setMessage(await copyToolText(text) ? "已复制" : "复制未成功，请长按或选中结果手动复制")}>
        <WenyouIcon id="action.copy" />复制全部
      </Button>
    </div>
    <Textarea aria-label="生成结果" value={text} readOnly rows={7} wrap="off" className="min-h-40 resize-y font-mono leading-relaxed" placeholder="结果会显示在这里" />
    <p role="status" className="min-h-5 text-sm text-muted-foreground">{message || "可直接选中并复制；离开页面后不保留。"}</p>
  </section>;
}
