"use client";

import type { RefObject } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SettingsDialog, SettingsSaveFooter } from "./settings-controls";
import { useEditorToolbarPreference } from "@/components/editor/use-editor-toolbar-preference";
import { EditorToolbarArrangement } from "./editor-toolbar-arrangement";
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
      <EditorToolbarArrangement primary={primary} more={more} onChange={change} />
      {errors.root ? <p role="alert" className="mt-3 text-sm text-destructive">{errors.root.message}</p> : null}
      <div className="mt-4 flex items-end justify-between gap-3">
        <Button type="button" variant="ghost" onClick={restore}>恢复默认</Button>
        <SettingsSaveFooter busy={isSubmitting} disabled={!isDirty} />
      </div>
    </form>
  </SettingsDialog>;
}
