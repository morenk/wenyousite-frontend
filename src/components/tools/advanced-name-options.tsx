"use client";
import { useId } from "react";
import type { Country } from "@/lib/tools/names";
import { chronologicalAdvancedStyles, type AdvancedNameData, type AdvancedNameOptions } from "@/lib/tools/advanced-names";
import { Button } from "@/components/ui/button";
import { ToolSelect } from "./tool-controls";

export type AdvancedSelection = Pick<AdvancedNameOptions, "mode" | "styleId" | "structureId"> & { enabled: boolean };
export const emptyAdvancedSelection: AdvancedSelection = { enabled: false, mode: "historical", styleId: "", structureId: "" };
export function defaultAdvancedSelection(data: AdvancedNameData, country: Country, mode: AdvancedSelection["mode"] = "historical"): AdvancedSelection {
  const style = data.styles.find((item) => item.country === country && item.mode === mode)!;
  return { enabled: true, mode, styleId: style.id, structureId: style.defaultStructureId };
}
export function AdvancedNameOptionsPanel({ country, data, selection, onChange, onToggle, onRetry, loading, error, disabled, embedded }: {
  country: Country; data: AdvancedNameData | null; selection: AdvancedSelection;
  onChange: (value: AdvancedSelection) => void; onToggle: () => void; onRetry: () => void;
  loading: boolean; error: string; disabled?: boolean; embedded?: boolean;
}) {
  const id = useId();
  const styles = data ? chronologicalAdvancedStyles(data, country, selection.mode) : [];
  const style = styles.find((item) => item.id === selection.styleId);
  return <section className="min-w-0 border-t border-border pt-3">
    <button type="button" disabled={disabled} aria-expanded={selection.enabled} aria-controls={id}
      className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-normal" onClick={onToggle}>
      <span>进阶选项</span>
      <span aria-hidden="true" className="text-muted-foreground">{selection.enabled ? "−" : "+"}</span>
    </button>
    {selection.enabled && <div id={id} className="grid min-w-0 gap-3 pt-2">
      {loading && <p role="status" className="text-sm text-muted-foreground">正在加载词库…</p>}
      {error && <div role="alert" className="flex items-center justify-between gap-2 text-sm text-destructive">
        <span>{error}</span><Button type="button" size="compact" variant="ghost" onClick={onRetry}>重试</Button>
      </div>}
      {style && <div className="grid min-w-0 gap-3">
        <ToolSelect label="类型" value={selection.mode} disabled={disabled} embedded={embedded}
          options={[{ id: "historical", label: "史实参考" }, { id: "literary", label: "文学创作" }]}
          onChange={(mode) => onChange(defaultAdvancedSelection(data!, country, mode as AdvancedSelection["mode"]))} />
        <ToolSelect label="风格" value={style.id} options={styles.map((item) => ({ id: item.id, label: item.label }))}
          disabled={disabled} embedded={embedded} onChange={(styleId) => {
            const next = styles.find((item) => item.id === styleId)!;
            onChange({ ...selection, styleId, structureId: next.defaultStructureId });
          }} />
        {style.structures.length > 1 && <ToolSelect label="姓名结构" value={selection.structureId} options={style.structures}
          disabled={disabled} embedded={embedded} onChange={(structureId) => onChange({ ...selection, structureId })} />}
      </div>}
    </div>}
  </section>;
}
