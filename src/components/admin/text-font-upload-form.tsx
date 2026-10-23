"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  adminTextFontUploadSchema, fontLanguageLabels, fontNameFromFile,
  type AdminTextFontUploadValues, type FontLanguage,
} from "@/lib/admin-text-font-upload";
import { getApiError, getApiErrorMessage } from "@/api/errors";

export type FontUploadProgress =
  | { phase: "creating" | "processing" | "checking" }
  | { phase: "uploading"; loaded: number; total: number };

export function TextFontUploadForm({ existing, progress, disabled = false, onSubmit }: {
  existing?: { name: string; language: FontLanguage };
  progress?: FontUploadProgress;
  disabled?: boolean;
  onSubmit: (values: AdminTextFontUploadValues) => Promise<void>;
}) {
  const id = useId();
  const lock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<AdminTextFontUploadValues>({
    resolver: zodResolver(adminTextFontUploadSchema),
    defaultValues: { name: existing?.name ?? "", language: existing?.language ?? "other" },
  });
  const existingName = existing?.name, existingLanguage = existing?.language;
  useEffect(() => {
    if (existingName !== undefined && existingLanguage) {
      form.setValue("name", existingName);
      form.setValue("language", existingLanguage);
    }
  }, [existingName, existingLanguage, form]);
  const selectedFile = useWatch({ control: form.control, name: "file" });
  const busy = submitting || Boolean(progress);
  const inactive = disabled || busy;
  const phaseLabel = progress?.phase === "creating" ? "正在准备…"
    : progress?.phase === "uploading" ? "正在上传…"
      : progress?.phase === "processing" ? "正在处理…"
        : progress?.phase === "checking" ? "正在查询结果…" : "正在提交…";
  const percentage = progress?.phase === "uploading" && progress.total > 0
    ? Math.min(100, Math.max(0, Math.floor(progress.loaded / progress.total * 100))) : null;
  return (
    <form className="space-y-4" onSubmit={(event) => { void form.handleSubmit(async (values) => {
      if (lock.current || disabled || progress) return;
      lock.current = true; setSubmitting(true); form.clearErrors("root");
      try { await onSubmit(values); }
      catch (error) {
        const message = getApiErrorMessage(error, "上传未完成，请重试");
        const field = getApiError(error).code === 40001 ? message.match(/^(name|language)(?:\b|\.)/)?.[1] : undefined;
        form.setError(field === "name" || field === "language" ? field : "root", { message });
      }
      finally { lock.current = false; setSubmitting(false); }
    })(event); }}>
      <FormField id={`${id}-file`} label="字体文件" description="TTF / OTF，最大 64 MiB" error={form.formState.errors.file?.message} errorRole="alert">
        {(props) => <div className="flex min-w-0 items-center gap-3 rounded-[var(--radius-control)] border border-input bg-card p-2">
          <Button type="button" variant="outline" size="compact" disabled={inactive} aria-controls={props.id} aria-describedby={props["aria-describedby"]} onClick={() => fileInput.current?.click()}>选择文件</Button>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={selectedFile?.name}>{selectedFile?.name ?? "未选择文件"}</span>
          <Input {...props} ref={fileInput} className="hidden" tabIndex={-1} type="file" accept=".ttf,.otf" disabled={inactive} onChange={(event) => {
          const file = event.target.files?.[0];
          form.setValue("file", file as File, { shouldValidate: true });
          if (file && !existing && !form.getFieldState("name").isDirty) {
            form.setValue("name", fontNameFromFile(file.name), { shouldValidate: true });
          }
        }} /></div>}
      </FormField>
      {!existing && <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <FormField id={`${id}-name`} label="字体名称" error={form.formState.errors.name?.message} errorRole="alert">
          {(props) => <Input {...props} {...form.register("name")} disabled={inactive} />}
        </FormField>
        <FormField id={`${id}-language`} label="语言" error={form.formState.errors.language?.message} errorRole="alert">
          {(props) => <Controller name="language" control={form.control} render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={inactive}>
              <SelectTrigger {...props} className="w-full"><SelectValue>{fontLanguageLabels[field.value]}</SelectValue></SelectTrigger>
              <SelectContent>{Object.entries(fontLanguageLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          )} />}
        </FormField>
      </div>}
      {busy && <div className="space-y-2" role="status" aria-live="polite">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>{phaseLabel}</span>
          {progress?.phase === "uploading" && percentage !== null && <span className="font-utility text-muted-foreground">{percentage}% · {(progress.loaded / 1048576).toFixed(1)} / {(progress.total / 1048576).toFixed(1)} MiB</span>}
        </div>
        <Progress aria-label={phaseLabel} value={percentage} />
      </div>}
      {form.formState.errors.root && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
      <Button type="submit" disabled={inactive}>上传并处理</Button>
    </form>
  );
}
