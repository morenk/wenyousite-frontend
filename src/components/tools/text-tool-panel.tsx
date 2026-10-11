"use client";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToolResult, ToolSelect } from "./tool-controls";
import { TEXT_LIMIT } from "@/lib/tools/catalog";
import { encodeMorse, decodeMorse } from "@/lib/tools/morse";
import { FANCY_STYLES, fancyText } from "@/lib/tools/fancy";
const schema = z.object({
  input: z.string().max(TEXT_LIMIT, "请将输入控制在 10,000 个字符以内"),
  mode: z.enum(["encode", "decode"]),
  fancy: z.enum(["bold", "italic", "script", "fraktur", "double", "mono", "full"]),
});
type Values = z.infer<typeof schema>;
export function TextToolPanel({ tool }: { tool: "morse" | "fancy" }) {
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { input: "", mode: "encode", fancy: "script" } });
  const submit = (values: Values) => {
    setError("");
    try {
      setOutput(tool === "morse" ? (values.mode === "encode" ? encodeMorse(values.input) : decodeMorse(values.input)) : fancyText(values.input, values.fancy));
    } catch (cause) { setOutput(""); setError((cause as Error).message); }
  };
  const feedback = error || Object.values(form.formState.errors).map((item) => item.message).join("；");
  return <div className="grid gap-5">
    <form onSubmit={form.handleSubmit(submit)} className="grid gap-5 rounded-[var(--radius-card)] bg-card p-5 sm:p-6">
      <div className="grid gap-2"><label htmlFor="tool-input" className="text-sm font-medium">{tool === "morse" ? "文字或摩斯码" : "输入文字"}</label>
        <Textarea id="tool-input" {...form.register("input")} rows={6} className="min-h-36 resize-y" maxLength={TEXT_LIMIT} />
        <p className="text-xs text-muted-foreground">最多 10,000 个字符</p>
      </div>
      {tool === "morse" && <>
        <Controller name="mode" control={form.control} render={({ field }) => <ToolSelect label="转换方向" value={field.value} onChange={field.onChange} options={[{ id: "encode", label: "文字 → 摩斯码" }, { id: "decode", label: "摩斯码 → 文字" }]} />} />
        <p className="text-sm leading-relaxed text-muted-foreground">支持 A–Z、0–9、é 和 . , ? &apos; / ( ) : = + - &quot; @。字符用空格分隔，单词用 / 分隔；解码为大写。</p>
      </>}
      {tool === "fancy" && <>
        <Controller name="fancy" control={form.control} render={({ field }) => <ToolSelect label="文字样式" value={field.value} onChange={field.onChange} options={FANCY_STYLES} />} />
        <p className="text-sm leading-relaxed text-muted-foreground">不支持的字符保留原样；部分设备可能缺字，花体可能影响搜索与读屏。</p>
      </>}
      <div role="alert" className={cn("text-sm text-destructive", !feedback && "sr-only")}>{feedback}</div>
      <div className="flex gap-3"><Button type="submit">生成文字</Button><Button type="button" variant="ghost" onClick={() => { form.setValue("input", ""); setOutput(""); setError(""); }}>清空</Button></div>
    </form>
    <ToolResult key={output} text={output} />
  </div>;
}
