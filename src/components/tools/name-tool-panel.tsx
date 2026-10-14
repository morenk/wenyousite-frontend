"use client";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COUNTRIES, generateBilingualNames, loadNameData, needsSurnameTranslation, type NameData, type NameEntry, type NameOptions } from "@/lib/tools/names";
import { advancedNameCountries, generateAdvancedNames, loadAdvancedNameData, type AdvancedNameData } from "@/lib/tools/advanced-names";
import { AdvancedNameOptionsPanel, defaultAdvancedSelection, emptyAdvancedSelection, type AdvancedSelection } from "./advanced-name-options";
import { NameResults } from "./name-results";
import { ToolResult, ToolSelect, useToolReady } from "./tool-controls";
const schema = z.object({
  country: z.enum(["cn", "jp", "gb", "de", "fr", "ru", "us", "it", "es", "kr", "br"]),
  sex: z.enum(["any", "female", "male"]), style: z.enum(["common", "classical", "fantasy"]),
  surname: z.string().max(40, "姓氏最多 40 字").refine((value) => !/[\r\n\t]/.test(value), "姓氏须为单行文字"),
  surnameZh: z.string().max(40, "姓氏中文写法最多 40 字").refine((value) => !/[\r\n\t]/.test(value), "姓氏须为单行文字").optional(),
  count: z.number().int().min(1, "至少生成 1 个").max(50, "每次最多 50 个"),
});
export function NameToolPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const ready = useToolReady();
  const form = useForm<NameOptions>({ resolver: zodResolver(schema), defaultValues: { country: "cn", sex: "any", style: "common", surname: "", surnameZh: "", count: 10 } });
  const country = useWatch({ control: form.control, name: "country" });
  const surname = useWatch({ control: form.control, name: "surname" });
  const [dictionary, setDictionary] = useState<{ country: string; data: NameData } | null>(null);
  const [results, setResults] = useState<NameEntry[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedSelection>(emptyAdvancedSelection);
  const [advancedData, setAdvancedData] = useState<AdvancedNameData | null>(null);
  const [advancedLoading, setAdvancedLoading] = useState(false);
  const [advancedError, setAdvancedError] = useState("");
  const advancedRequest = useRef(0);
  const [resultCountry, setResultCountry] = useState("cn");
  const output = results.map((item) => item.original).join("\n");
  const needsChinese = !advanced.enabled && dictionary?.country === country && needsSurnameTranslation(dictionary.data, country, surname);
  useEffect(() => {
    if (country === "cn") return;
    let current = true;
    void loadNameData(country).then((data) => { if (current) setDictionary({ country, data }); }).catch(() => {});
    return () => { current = false; };
  }, [country]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const clearResults = () => { setResults([]); setError(""); setNote(""); form.clearErrors(); };
  const changeAdvanced = (next: AdvancedSelection) => { setAdvanced(next); clearResults(); };
  const resetAdvanced = () => {
    advancedRequest.current++;
    setAdvanced(emptyAdvancedSelection); setAdvancedLoading(false); setAdvancedError(""); clearResults();
  };
  const loadAdvanced = async () => {
    const request = ++advancedRequest.current;
    setAdvancedLoading(true); setAdvancedError("");
    try {
      const data = await loadAdvancedNameData();
      if (alive.current && request === advancedRequest.current) {
        setAdvancedData(data); setAdvanced(defaultAdvancedSelection(data, country));
      }
    } catch {
      if (alive.current && request === advancedRequest.current) setAdvancedError("词库加载失败");
    } finally { if (alive.current && request === advancedRequest.current) setAdvancedLoading(false); }
  };
  const toggleAdvanced = () => {
    clearResults();
    if (advanced.enabled) { resetAdvanced(); return; }
    if (advancedData) setAdvanced(defaultAdvancedSelection(advancedData, country));
    else { setAdvanced({ ...emptyAdvancedSelection, enabled: true }); void loadAdvanced(); }
  };
  const submit = async (values: NameOptions) => {
    setPending(true); setError(""); setResults([]); setNote("");
    try {
      if (advanced.enabled) {
        if (!advancedData) throw new Error("进阶词库尚未加载");
        const generated = generateAdvancedNames(advancedData, { country: values.country, sex: values.sex, count: values.count, ...advanced });
        setResults(generated); setResultCountry(values.country);
        if (generated.length < values.count) setNote("已生成 " + generated.length + " 个不重复姓名");
        return;
      }
      const data = await loadNameData(values.country);
      if (!alive.current) return;
      setDictionary({ country: values.country, data });
      if (needsSurnameTranslation(data, values.country, values.surname) && !values.surnameZh?.trim()) {
        form.setError("surnameZh", { message: "请填写姓氏中文写法" });
        return;
      }
      const results = generateBilingualNames(data, values);
      setResults(results);
      setResultCountry(values.country);
      if (results.length < values.count) setNote(`当前条件下已生成 ${results.length} 个不同名字，可调整条件后再试。`);
    } catch (cause) { if (alive.current) setError(cause instanceof Error && cause.message.includes("姓氏") ? cause.message : "词库加载或生成失败，请检查连接后重试"); }
    finally { if (alive.current) setPending(false); }
  };
  const feedback = error || Object.values(form.formState.errors).map((item) => item.message).join("；");
  return <div data-tool-panels className="grid gap-5"><form className="grid gap-5 rounded-[var(--radius-card)] bg-card p-5 sm:p-6" onSubmit={(event) => { void form.handleSubmit(submit)(event); }}>
    <fieldset disabled={!ready || pending} className="grid min-w-0 gap-4">
      <div className={cn("grid gap-3", embedded ? "grid-cols-2" : "grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))]")}>
        <Controller name="country" control={form.control} render={({ field }) => <ToolSelect embedded={embedded} label="国家" value={field.value} disabled={!ready || pending} onChange={(value) => { resetAdvanced(); field.onChange(value); form.setValue("surname", ""); form.setValue("surnameZh", ""); form.setValue("style", "common"); form.clearErrors("surnameZh"); }} options={COUNTRIES} />} />
        <Controller name="sex" control={form.control} render={({ field }) => <ToolSelect embedded={embedded} label="名字性别倾向" value={field.value} disabled={!ready || pending} onChange={field.onChange} options={[{ id: "any", label: "不限" }, { id: "female", label: "女性" }, { id: "male", label: "男性" }]} />} />
      </div>
      {!advanced.enabled && (!embedded || country === "cn") && <Controller name="style" control={form.control} render={({ field }) => <ToolSelect embedded={embedded} label="起名风格" value={field.value} disabled={!ready || pending || country !== "cn"} onChange={field.onChange} options={[{ id: "common", label: "常见人名" }, { id: "classical", label: "古风角色名（中文）" }, { id: "fantasy", label: "幻想角色名（中文）" }]} />} />}
      <div className={cn("grid gap-3", embedded ? "grid-cols-2" : "grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))]")}>
        {!advanced.enabled && <div className="grid gap-2"><label htmlFor="surname" className="text-sm font-normal">固定姓氏（可选）</label><Input id="surname" {...form.register("surname", { onChange: () => { form.setValue("surnameZh", ""); form.clearErrors("surnameZh"); } })} maxLength={40} placeholder="留空随机" autoComplete="off" /></div>}
        <div className="grid gap-2"><label htmlFor="name-count" className="text-sm font-normal">生成数量</label><Input id="name-count" type="number" min={1} max={50} {...form.register("count", { valueAsNumber: true })} /></div>
      </div>
      {needsChinese && <div className="grid gap-2"><label htmlFor="surname-zh" className="text-sm font-normal">姓氏中文写法</label><Input id="surname-zh" {...form.register("surnameZh")} maxLength={40} autoComplete="off" aria-invalid={!!form.formState.errors.surnameZh} /></div>}
      {advancedNameCountries.includes(country) && <AdvancedNameOptionsPanel country={country} data={advancedData} selection={advanced}
        onChange={changeAdvanced} onToggle={toggleAdvanced} onRetry={() => { void loadAdvanced(); }} loading={advancedLoading} error={advancedError} disabled={!ready || pending} embedded={embedded} />}
    </fieldset>
    {!advanced.enabled && country === "ru" && !!surname.trim() && <p className="text-sm text-muted-foreground">随机姓氏随性别变化，固定姓氏原样保留。</p>}
    <div role="alert" className={cn("text-sm text-destructive", !feedback && "sr-only")}>{feedback}</div>
    <Button type="submit" disabled={!ready || (advanced.enabled && (advancedLoading || !advanced.styleId))} className="justify-self-start" pending={pending} pendingLabel="正在加载词库…">{error ? "重试生成" : "生成名字"}</Button>
    <p role="status" className={cn("text-sm text-muted-foreground", !note && "sr-only")}>{note}</p>
  </form>{resultCountry !== "cn" && results.length ? <NameResults key={output} entries={results} embedded={embedded} /> : <ToolResult hideHeading key={output} text={output} embedded={embedded} entries={embedded ? output.split("\n").filter(Boolean) : undefined} />}</div>;
}
