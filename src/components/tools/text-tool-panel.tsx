"use client";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToolResult, ToolSelect } from "./tool-controls";
import { TEXT_LIMIT } from "@/lib/tools/catalog";
import { verticalText } from "@/lib/tools/vertical";
import { encodeMorse, decodeMorse } from "@/lib/tools/morse";
import { FANCY_STYLES, fancyText } from "@/lib/tools/fancy";
const schema = z.object({
  input: z.string().max(TEXT_LIMIT, "请将输入控制在 10,000 个字符以内"),
  height: z.number().int().min(1, "每列至少 1 字").max(100, "每列最多 100 字"),
  gap: z.number().int().min(0, "空格不能小于 0").max(10, "列间最多 10 个空格"),
  direction: z.enum(["right", "left"]), mode: z.enum(["encode", "decode"]),
  fancy: z.enum(["bold", "italic", "script", "fraktur", "double", "mono", "full"]),
});
type Values = z.infer<typeof schema>;
export function TextToolPanel({ tool }: { tool: "vertical" | "morse" | "fancy" }) {
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { input: "", height: 8, gap: 2, direction: "right", mode: "encode", fancy: "script" } });
  const submit = (values: Values) => {
    setError("");
    try {
      setOutput(tool === "vertical" ? verticalText(values.input, values) : tool === "morse" ? (values.mode === "encode" ? encodeMorse(values.input) : decodeMorse(values.input)) : fancyText(values.input, values.fancy));
    } catch (cause) { setOutput(""); setError((cause as Error).message); }
  };
  return <div className="grid gap-5">
    <form onSubmit={form.handleSubmit(submit)} className="grid gap-5">
      <div className="grid gap-2"><label htmlFor="tool-input" className="text-sm font-medium">{tool === "morse" ? "文字或摩斯码" : "输入文字"}</label>
        <Textarea id="tool-input" {...form.register("input")} rows={6} className="min-h-36 resize-y" maxLength={TEXT_LIMIT} placeholder={tool === "fancy" ? "Wenyou, write your own story." : tool === "morse" ? "SOS / ... --- ..." : "山海有信，温油相逢。"} />
        <p className="text-xs text-muted-foreground">最多 10,000 个字符 · 仅在当前设备处理</p>
      </div>
      {tool === "vertical" && <>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2"><label htmlFor="column-height" className="text-sm font-medium">每列字数</label><Input id="column-height" type="number" min={1} max={100} {...form.register("height", { valueAsNumber: true })} /></div>
          <div className="grid gap-2"><label htmlFor="column-gap" className="text-sm font-medium">列间空格数</label><Input id="column-gap" type="number" min={0} max={10} {...form.register("gap", { valueAsNumber: true })} /></div>
        </div>
        <Controller name="direction" control={form.control} render={({ field }) => <ToolSelect label="阅读顺序" value={field.value} onChange={field.onChange} options={[{ id: "right", label: "从右向左（默认）" }, { id: "left", label: "从左向右" }]} />} />
        <p className="text-sm leading-relaxed text-muted-foreground">每列从上向下读，换行分段。半角字符会补齐字格，列间再插入指定空格；复制到等宽字体下效果更好。</p>
      </>}
      {tool === "morse" && <>
        <Controller name="mode" control={form.control} render={({ field }) => <ToolSelect label="转换方向" value={field.value} onChange={field.onChange} options={[{ id: "encode", label: "文字 → 摩斯码" }, { id: "decode", label: "摩斯码 → 文字" }]} />} />
        <p className="text-sm leading-relaxed text-muted-foreground">支持 A–Z、0–9、é 和 . , ? &apos; / ( ) : = + - &quot; @。字符用空格分隔，单词用 / 分隔；解码为大写。中文等不支持字符会提示，不会被忽略。</p>
      </>}
      {tool === "fancy" && <>
        <Controller name="fancy" control={form.control} render={({ field }) => <ToolSelect label="文字样式" value={field.value} onChange={field.onChange} options={FANCY_STYLES} />} />
        <p className="text-sm leading-relaxed text-muted-foreground">转换为可复制的 Unicode 字符，中文和其他不支持字符保持原样。部分设备可能缺少字形；花体会影响搜索与读屏，适合短标题和装饰。</p>
      </>}
      <div role="alert" className="text-sm text-destructive">{error || Object.values(form.formState.errors).map((item) => item.message).join("；")}</div>
      <div className="flex gap-3"><Button type="submit">生成文字</Button><Button type="button" variant="ghost" onClick={() => { form.setValue("input", ""); setOutput(""); setError(""); }}>清空</Button></div>
    </form>
    <ToolResult key={output} text={output} />
  </div>;
}
