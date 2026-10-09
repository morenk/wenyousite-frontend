"use client";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COUNTRIES, generateNames, loadNameData, type NameOptions } from "@/lib/tools/names";
import { ToolResult, ToolSelect } from "./tool-controls";
const schema = z.object({
  country: z.enum(["cn", "jp", "gb", "de", "fr", "ru", "us", "it", "es", "kr", "br"]),
  sex: z.enum(["any", "female", "male"]), style: z.enum(["common", "classical", "fantasy"]),
  surname: z.string().max(40, "姓氏最多 40 字").refine((value) => !/[\r\n\t]/.test(value), "姓氏须为单行文字"),
  count: z.number().int().min(1, "至少生成 1 个").max(50, "每次最多 50 个"),
});
export function NameToolPanel() {
  const form = useForm<NameOptions>({ resolver: zodResolver(schema), defaultValues: { country: "cn", sex: "any", style: "common", surname: "", count: 10 } });
  const country = useWatch({ control: form.control, name: "country" });
  const style = useWatch({ control: form.control, name: "style" });
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const submit = async (values: NameOptions) => {
    setPending(true); setError(""); setOutput(""); setNote("");
    try {
      const data = await loadNameData(values.country);
      if (!alive.current) return;
      const results = generateNames(data, values);
      setOutput(results.join("\n"));
      if (results.length < values.count) setNote(`当前条件下已生成 ${results.length} 个不同名字，可调整条件后再试。`);
    } catch { if (alive.current) setError("词库加载或生成失败，请检查连接后重试"); }
    finally { if (alive.current) setPending(false); }
  };
  return <div className="grid gap-5"><form className="grid gap-5" onSubmit={(event) => { void form.handleSubmit(submit)(event); }}>
    <fieldset disabled={pending} className="grid min-w-0 gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Controller name="country" control={form.control} render={({ field }) => <ToolSelect label="国家" value={field.value} disabled={pending} onChange={(value) => { field.onChange(value); if (value !== "cn") form.setValue("style", "common"); }} options={COUNTRIES} />} />
        <Controller name="sex" control={form.control} render={({ field }) => <ToolSelect label="名字性别倾向" value={field.value} disabled={pending} onChange={field.onChange} options={[{ id: "any", label: "不限" }, { id: "female", label: "女性" }, { id: "male", label: "男性" }]} />} />
      </div>
      <Controller name="style" control={form.control} render={({ field }) => <ToolSelect label="起名风格" value={field.value} disabled={pending || country !== "cn"} onChange={field.onChange} options={[{ id: "common", label: "常见人名" }, { id: "classical", label: "古风角色名（中文）" }, { id: "fantasy", label: "幻想角色名（中文）" }]} />} />
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><label htmlFor="surname" className="text-sm font-medium">固定姓氏（可选）</label><Input id="surname" {...form.register("surname")} maxLength={40} placeholder="留空随机" autoComplete="off" /></div>
        <div className="grid gap-2"><label htmlFor="name-count" className="text-sm font-medium">生成数量</label><Input id="name-count" type="number" min={1} max={50} {...form.register("count", { valueAsNumber: true })} /></div>
      </div>
    </fieldset>
    <p className="text-sm leading-relaxed text-muted-foreground">{style !== "common" ? "自编中文组合，为古风和幻想角色提供名字灵感。" : "中文可选古风、幻想风；其他国家保留原文拼写。"} {country === "ru" ? "随机姓氏随性别选取；手填姓氏将按原样保留。" : ""}</p>
    <div role="alert" className="text-sm text-destructive">{error || Object.values(form.formState.errors).map((item) => item.message).join("；")}</div>
    <Button type="submit" className="justify-self-start" pending={pending} pendingLabel="正在加载词库…">{error ? "重试生成" : "生成名字"}</Button>
    {note && <p role="status" className="text-sm text-muted-foreground">{note}</p>}
  </form><ToolResult key={output} text={output} /></div>;
}
