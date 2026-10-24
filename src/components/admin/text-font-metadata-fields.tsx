"use client";

import { useState } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDown } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TextFontConfigurationValues } from "@/lib/admin-text-font-form";

/** 可选补充资料默认折叠；保留现有字段语义，不在此发起配置写入。 */
export function TextFontMetadataFields({ form, disabled }: {
  form: UseFormReturn<TextFontConfigurationValues>; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasErrors = ["author", "sourceUrl", "licenseName", "licenseText", "specimenText"].some((field) => Boolean(form.formState.errors[field as keyof TextFontConfigurationValues]));
  return <Collapsible.Root open={open || hasErrors} onOpenChange={setOpen} className="border-t border-border pt-3">
    <Collapsible.Trigger className="group flex w-full items-center justify-between rounded-[var(--radius-control)] py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
      更多信息<ChevronDown className="size-4 text-muted-foreground transition-transform group-data-panel-open:rotate-180" />
    </Collapsible.Trigger>
    <Collapsible.Panel>
      <fieldset disabled={disabled} className="grid gap-4 pt-3 sm:grid-cols-2">
        {Object.entries({ author: "作者", sourceUrl: "来源链接", licenseName: "许可名称", specimenText: "样张文字" } as const).map(([key, label]) => {
          const name = key as "author" | "sourceUrl" | "licenseName" | "specimenText";
          return <FormField key={name} id={`font-more-${name}`} label={label} error={form.formState.errors[name]?.message} errorRole="alert">
            {(props) => <Input {...props} {...form.register(name)} />}
          </FormField>;
        })}
        <FormField id="font-more-licenseText" className="col-span-full" label="许可内容" error={form.formState.errors.licenseText?.message} errorRole="alert">
          {(props) => <Textarea {...props} rows={4} {...form.register("licenseText")} />}
        </FormField>
      </fieldset>
    </Collapsible.Panel>
  </Collapsible.Root>;
}
