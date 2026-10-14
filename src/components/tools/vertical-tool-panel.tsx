"use client";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TEXT_LIMIT } from "@/lib/tools/catalog";
import { verticalText } from "@/lib/tools/vertical";
import { ToolResult, ToolSelect, useToolReady } from "./tool-controls";

const base = z.object({
  input: z.string().max(TEXT_LIMIT, "请将输入控制在 10,000 个字符以内"),
  width: z.number().int().min(1, "页宽至少 1 列").max(100, "页宽最多 100 列"),
  height: z.number().int().min(1, "页高至少 1 字").max(100, "页高最多 100 字"),
  direction: z.enum(["right", "left"]),
});
const schema = z.discriminatedUnion("separatorMode", [
  base.extend({ separatorMode: z.literal("spaces"), gap: z.number().int().min(0, "空格不能小于 0").max(10, "列间最多 10 个空格"), separator: z.string() }),
  base.extend({ separatorMode: z.literal("custom"), gap: z.unknown(), separator: z.string().max(20, "分隔符最多 20 个字符").refine(value => !/[\x00-\x1f\x7f-\x9f\u2028\u2029]/u.test(value), "分隔符不能包含换行或控制字符") }),
]);
type Values = z.infer<typeof schema>;
const example = "床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。";

export function VerticalToolPanel({ embedded = false }: { embedded?: boolean }) {
  const ready = useToolReady();
  const [output, setOutput] = useState("");
  const [resultDirection, setResultDirection] = useState<"left" | "right">("right");
  const [error, setError] = useState("");
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { input: "", width: 10, height: 20, gap: 2, direction: "right", separatorMode: "spaces", separator: " | " } });
  const separatorMode = useWatch({ control: form.control, name: "separatorMode" });
  const gap = useWatch({ control: form.control, name: "gap" });
  const separator = useWatch({ control: form.control, name: "separator" });
  const replaceInput = (text: string) => { form.setValue("input", text, { shouldValidate: true }); setOutput(""); setError(""); };
  const submit = (values: Values) => {
    setError("");
    try { setResultDirection(values.direction); setOutput(verticalText(values.input, { width: values.width, height: values.height, direction: values.direction, gap: values.separatorMode === "spaces" ? values.gap : 0, separator: values.separatorMode === "custom" ? values.separator : undefined })); }
    catch (cause) { setOutput(""); setError((cause as Error).message); }
  };
  const feedback = error || Object.values(form.formState.errors).map(item => item.message).join("；");
  const status = !ready ? "正在准备工具…" : "";
  const separation = <div className={cn("grid gap-3", embedded ? "grid-cols-2" : "grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))]")}>
    <Controller name="separatorMode" control={form.control} render={({ field }) => <ToolSelect embedded={embedded} label="列间分隔" value={field.value} disabled={!ready} onChange={field.onChange} options={[{ id: "spaces", label: "空格数" }, { id: "custom", label: "自定义" }]} />} />
    {separatorMode === "spaces" ? <div className="grid gap-2"><label htmlFor="column-gap" className="text-sm font-medium">列间空格数</label><Input id="column-gap" type="number" min={0} max={10} {...form.register("gap", { valueAsNumber: true })} /></div> : <div className="grid gap-2"><label htmlFor="column-separator" className="text-sm font-medium">自定义分隔符</label><Input id="column-separator" maxLength={20} {...form.register("separator")} /></div>}
  </div>;
  return <div data-tool-panels className="grid gap-5">
    <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 rounded-[var(--radius-card)] bg-card p-5 sm:p-6">
      <fieldset disabled={!ready} className="grid min-w-0 gap-4">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor="vertical-input" className="text-sm font-medium">输入文字</label>
            <Button type="button" variant="ghost" onClick={() => replaceInput(example)}>示例：静夜思</Button>
          </div>
          <Textarea id="vertical-input" {...form.register("input")} rows={embedded ? 4 : 5} maxLength={TEXT_LIMIT} className={cn("resize-y", embedded ? "field-sizing-fixed h-32 min-h-28" : "min-h-32")} />
          <p className="text-xs text-muted-foreground">最多 10,000 个字符</p>
        </div>
        <div className={cn("grid gap-3", embedded ? "grid-cols-2" : "grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))]")}>
          <div className="grid gap-2"><label htmlFor="page-width" className="text-sm font-medium">页宽（每页列数）</label><Input id="page-width" type="number" min={1} max={100} {...form.register("width", { valueAsNumber: true })} /></div>
          <div className="grid gap-2"><label htmlFor="page-height" className="text-sm font-medium">页高（每列字数）</label><Input id="page-height" type="number" min={1} max={100} {...form.register("height", { valueAsNumber: true })} /></div>
        </div>
        {embedded ? <details className="group min-w-0 rounded-[var(--radius-control)] border border-border px-3">
          <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-x-2 py-2 text-sm font-medium"><span className="inline-flex items-center gap-2"><WenyouIcon id="navigation.expand" className="size-4 group-open:hidden" /><WenyouIcon id="navigation.collapse" className="hidden size-4 group-open:block" />列间设置</span><span className="min-w-0 break-all text-muted-foreground">{separatorMode === "spaces" ? `${typeof gap === "number" && Number.isFinite(gap) ? gap : "—"} 个空格` : separator ? `「${separator}」` : "无分隔符"}</span></summary>
          <div className="pb-3">{separation}</div>
        </details> : separation}
        <Controller name="direction" control={form.control} render={({ field }) => <ToolSelect embedded={embedded} label="阅读顺序" value={field.value} disabled={!ready} onChange={field.onChange} options={[{ id: "right", label: "从右向左（默认）" }, { id: "left", label: "从左向右" }]} />} />
        <p className="text-sm leading-relaxed text-muted-foreground">换行另起一列，空行留空列；超出页宽后分页。</p>
        <div className="flex flex-wrap gap-3"><Button type="submit">生成文字</Button><Button type="button" variant="ghost" onClick={() => replaceInput("")}>清空</Button></div>
      </fieldset>
      <div role="alert" className={cn("text-sm text-destructive", !feedback && "sr-only")}>{feedback}</div>
      <p role="status" className={cn("text-xs text-muted-foreground", !status && "sr-only")}>{status}</p>
    </form>
    <ToolResult key={output} text={output} embedded={embedded} scrollStart={resultDirection} resultClassName={embedded ? "field-sizing-fixed h-48 max-h-64" : "field-sizing-fixed h-64 max-h-80"} />
  </div>;
}
