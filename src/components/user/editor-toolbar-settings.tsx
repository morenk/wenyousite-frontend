"use client";

import type { RefObject } from "react";
import { ArrowDown, ArrowUp, ArrowLeftRight } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { SettingsDialog, SettingsSaveFooter } from "./settings-controls";
import { useEditorToolbarPreference } from "@/components/editor/use-editor-toolbar-preference";
import { EDITOR_CAPABILITY_LABELS } from "@/lib/editor-capabilities";
import { editorIconId } from "@/lib/editor-icons";
import {
  EDITOR_TOOLBAR_TOOLS, defaultCustomToolbar, saveEditorToolbarPreference,
  type EditorToolbarTool,
} from "@/lib/editor-toolbar-preference";

const schema = z.object({
  custom: z.boolean(),
  primary: z.array(z.enum(EDITOR_TOOLBAR_TOOLS)),
  more: z.array(z.enum(EDITOR_TOOLBAR_TOOLS)),
});
type Values = z.infer<typeof schema>;
export function EditorToolbarSettings({ onClose, returnFocus }: {
  onClose: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const preference = useEditorToolbarPreference();
  const defaults = preference ?? defaultCustomToolbar();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { custom: Boolean(preference), primary: defaults.primary, more: defaults.more },
  });
  const primary = useWatch({ control: form.control, name: "primary" });
  const more = useWatch({ control: form.control, name: "more" });
  const { isDirty, errors, isSubmitting } = form.formState;
  const change = (nextPrimary: EditorToolbarTool[], nextMore: EditorToolbarTool[]) => {
    form.setValue("custom", true, { shouldDirty: true });
    form.setValue("primary", nextPrimary, { shouldDirty: true });
    form.setValue("more", nextMore, { shouldDirty: true });
    form.clearErrors();
  };
  const move = (zone: "primary" | "more", id: EditorToolbarTool, direction: -1 | 1 | "across") => {
    const source = [...(zone === "primary" ? primary : more)];
    const target = [...(zone === "primary" ? more : primary)];
    const index = source.indexOf(id);
    if (index === -1) return;
    if (direction === "across") { source.splice(index, 1); target.push(id); }
    else {
      const next = index + direction;
      if (next < 0 || next >= source.length) return;
      [source[index], source[next]] = [source[next], source[index]];
    }
    change(zone === "primary" ? source : target, zone === "more" ? source : target);
  };
  const restore = () => {
    const next = defaultCustomToolbar();
    form.setValue("custom", false, { shouldDirty: true });
    form.setValue("primary", next.primary, { shouldDirty: true });
    form.setValue("more", next.more, { shouldDirty: true });
    form.clearErrors();
  };
  const save = form.handleSubmit((values) => {
    if (!saveEditorToolbarPreference(values.custom ? { version: 1, primary: values.primary, more: values.more } : null)) {
      form.setError("root", { message: "本机设置保存失败，请检查浏览器存储权限。" });
      return;
    }
    onClose();
  });
  return <SettingsDialog title="编辑器工具栏" onClose={onClose} returnFocus={returnFocus} dirty={isDirty} wide>
    <form onSubmit={save}>
      <div className="grid max-h-[60vh] gap-4 overflow-y-auto sm:grid-cols-2">
        {(["primary", "more"] as const).map((zone) => {
          const items = zone === "primary" ? primary : more;
          const title = zone === "primary" ? "主栏" : "展开栏";
          const destination = zone === "primary" ? "展开栏" : "主栏";
          return <section key={zone} aria-label={title} className="min-w-0">
            <h3 className="mb-2 text-sm font-semibold">{title}</h3>
            <ol className="min-h-12 space-y-1 rounded-[var(--radius-card)] bg-muted/40 p-2">
              {items.map((id, index) => <li key={id} className="flex items-center gap-1 rounded-[var(--radius-control)] bg-background p-1">
                <WenyouIcon id={editorIconId(id)} className="mx-1 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 text-sm">{EDITOR_CAPABILITY_LABELS[id]}</span>
                <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} aria-label={`上移${EDITOR_CAPABILITY_LABELS[id]}`} title="上移" onClick={() => move(zone, id, -1)}><ArrowUp /></Button>
                <Button type="button" variant="ghost" size="icon-sm" disabled={index === items.length - 1} aria-label={`下移${EDITOR_CAPABILITY_LABELS[id]}`} title="下移" onClick={() => move(zone, id, 1)}><ArrowDown /></Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`将${EDITOR_CAPABILITY_LABELS[id]}移到${destination}`} title={`移到${destination}`} onClick={() => move(zone, id, "across")}><ArrowLeftRight /></Button>
              </li>)}
            </ol>
          </section>;
        })}
      </div>
      {errors.root ? <p role="alert" className="mt-3 text-sm text-destructive">{errors.root.message}</p> : null}
      <div className="mt-4 flex items-end justify-between gap-3">
        <Button type="button" variant="ghost" onClick={restore}>恢复默认</Button>
        <SettingsSaveFooter busy={isSubmitting} disabled={!isDirty} />
      </div>
    </form>
  </SettingsDialog>;
}
