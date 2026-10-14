"use client";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { Textarea } from "@/components/ui/textarea";
import { ToolResult, ToolSelect, useToolReady } from "./tool-controls";
import { TEXT_LIMIT } from "@/lib/tools/catalog";
import { encodeMorse, decodeMorse } from "@/lib/tools/morse";
import { FANCY_STYLES, fancyText } from "@/lib/tools/fancy";
const schema = z.object({
  input: z.string().max(TEXT_LIMIT, "请将输入控制在 10,000 个字符以内"),
  mode: z.enum(["encode", "decode"]),
  fancy: z.enum(["bold", "italic", "script", "fraktur", "double", "mono", "full"]),
});
type Values = z.infer<typeof schema>;
export function TextToolPanel({ tool, embedded = false }: { tool: "morse" | "fancy"; embedded?: boolean }) {
  const ready = useToolReady();
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { input: "", mode: "encode", fancy: "script" } });
  const submit = (values: Values) => {
    setError("");
    try {
      setOutput(tool === "morse" ? (values.mode === "encode" ? encodeMorse(values.input) : decodeMorse(values.input)) : fancyText(values.input, values.fancy));
    } catch (cause) { setOutput(""); setError((cause as Error).message); }
  };
  const mode = useWatch({ control: form.control, name: "mode" });
  const feedback = error || Object.values(form.formState.errors).map((item) => item.message).join("；");
  return <div data-tool-panels className="grid gap-5">
    <form onSubmit={form.handleSubmit(submit)} className="grid gap-5 rounded-[var(--radius-card)] bg-card p-5 sm:p-6">
      <fieldset disabled={!ready} className="grid min-w-0 gap-4">
      {embedded && tool === "morse" && <div role="group" aria-label="转换方向" className="grid grid-cols-2 gap-2">
        <Button type="button" variant={mode === "encode" ? "secondary" : "outline"} aria-pressed={mode === "encode"} onClick={() => form.setValue("mode", "encode")}>编码</Button>
        <Button type="button" variant={mode === "decode" ? "secondary" : "outline"} aria-pressed={mode === "decode"} onClick={() => form.setValue("mode", "decode")}>解码</Button>
      </div>}
      <div className="grid gap-2"><label htmlFor="tool-input" className="text-sm font-medium">{tool === "morse" ? (embedded ? (mode === "encode" ? "输入文字" : "输入摩斯码") : "文字或摩斯码") : "输入文字"}</label>
        <Textarea id="tool-input" {...form.register("input")} rows={embedded ? 4 : 6} className={cn("resize-y", embedded ? "field-sizing-fixed h-32 min-h-28" : "min-h-36")} maxLength={TEXT_LIMIT} />
        <p className="text-xs text-muted-foreground">最多 10,000 个字符</p>
      </div>
      {tool === "morse" && <>
        {!embedded && <Controller name="mode" control={form.control} render={({ field }) => <ToolSelect disabled={!ready} label="转换方向" value={field.value} onChange={field.onChange} options={[{ id: "encode", label: "文字 → 摩斯码" }, { id: "decode", label: "摩斯码 → 文字" }]} />} />}
        {embedded ? <details className="group text-sm text-muted-foreground"><summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium"><WenyouIcon id="navigation.next" className="size-4 transition-transform group-open:rotate-90" />字符与分隔规则</summary><p className="pt-2 leading-relaxed">支持 A–Z、0–9、é 和 . , ? &apos; / ( ) : = + - &quot; @。字符用空格分隔，单词用 / 分隔；解码为大写。</p></details> : <p className="text-sm leading-relaxed text-muted-foreground">支持 A–Z、0–9、é 和 . , ? &apos; / ( ) : = + - &quot; @。字符用空格分隔，单词用 / 分隔；解码为大写。</p>}
      </>}
      {tool === "fancy" && <>
        <Controller name="fancy" control={form.control} render={({ field }) => <ToolSelect disabled={!ready} label="文字样式" value={field.value} onChange={field.onChange} embedded={embedded} options={embedded ? FANCY_STYLES.map((style) => ({ ...style, preview: fancyText("Abc", style.id) })) : FANCY_STYLES} />} />
        <p className="text-sm leading-relaxed text-muted-foreground">不支持的字符保留原样；部分设备可能缺字，花体可能影响搜索与读屏。</p>
      </>}
      <div role="alert" className={cn("text-sm text-destructive", !feedback && "sr-only")}>{feedback}</div>
      <div className="flex flex-wrap gap-3"><Button type="submit">{embedded && tool === "morse" ? (mode === "encode" ? "生成摩斯码" : "解码为文字") : "生成文字"}</Button><Button type="button" variant="ghost" onClick={() => { form.setValue("input", ""); setOutput(""); setError(""); }}>清空</Button></div>
      </fieldset>
    </form>
    <ToolResult key={output} text={output} embedded={embedded} />
  </div>;
}
