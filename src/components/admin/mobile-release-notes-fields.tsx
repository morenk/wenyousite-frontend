"use client";

import { useId } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MobileReleaseNotesPreview, type MobileReleasePreviewIdentity } from "./mobile-release-notes-preview";
import { releaseNotesLines, type MobileReleaseFormValues } from "@/lib/mobile-release-form";


export function MobileReleaseNotesFields({
  form,
  identity,
  disabled = false,
}: {
  form: UseFormReturn<MobileReleaseFormValues>;
  identity: MobileReleasePreviewIdentity;
  disabled?: boolean;
}) {
  const id = useId();
  const [summary, itemsText] = useWatch({ control: form.control, name: ["summary", "itemsText"] });
  const { errors } = form.formState;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${id}-summary`}>更新摘要</Label>
        <Input
          id={`${id}-summary`}
          disabled={disabled}
          aria-invalid={Boolean(errors.summary)}
          aria-describedby={errors.summary ? `${id}-summary-error` : undefined}
          {...form.register("summary")}
        />
        {errors.summary ? <p role="alert" id={`${id}-summary-error`} className="text-xs text-destructive">{errors.summary.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-items`}>逐条更新内容</Label>
        <Textarea
          id={`${id}-items`}
          rows={6}
          disabled={disabled}
          aria-invalid={Boolean(errors.itemsText)}
          aria-describedby={`${id}-items-help${errors.itemsText ? ` ${id}-items-error` : ""}`}
          {...form.register("itemsText")}
        />
        <p id={`${id}-items-help`} className="text-xs text-muted-foreground">摘要最多 200 字；内容 1–30 项，每项最多 500 字。一行一项，空行会忽略，均按纯文本展示。</p>
        {errors.itemsText ? <p role="alert" id={`${id}-items-error`} className="text-xs text-destructive">{errors.itemsText.message}</p> : null}
      </div>
      <MobileReleaseNotesPreview identity={identity} summary={summary ?? ""} items={releaseNotesLines(itemsText ?? "")} />
    </div>
  );
}
