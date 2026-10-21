"use client";
import { Controller, type UseFormReturn } from "react-hook-form";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TextFontConfigurationValues } from "@/lib/admin-text-font-form";
const labels = {
  name: "字体名称",
  author: "作者",
  sourceUrl: "来源链接",
  licenseName: "授权名称",
  specimenText: "样张文字",
} as const;
export function TextFontFields({
  form,
  disabled,
}: {
  form: UseFormReturn<TextFontConfigurationValues>;
  disabled: boolean;
}) {
  return (
    <fieldset
      disabled={disabled}
      className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2"
    >
      {Object.entries(labels).map(([key, label]) => {
        const name = key as keyof typeof labels;
        return (
          <FormField
            key={name}
            id={`font-${name}`}
            label={label}
            error={form.formState.errors[name]?.message}
            errorRole="alert"
          >
            {(props) => <Input {...props} {...form.register(name)} />}
          </FormField>
        );
      })}
      <FormField
        id="font-language"
        label="主要语言"
        error={form.formState.errors.designLanguage?.message}
        errorRole="alert"
      >
        {(props) => (
          <Controller
            control={form.control}
            name="designLanguage"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  if (value) field.onChange(value);
                }}
                disabled={disabled}
              >
                <SelectTrigger {...props}>
                  <SelectValue>
                    {
                      (
                        {
                          zh: "中文",
                          ja: "日文",
                          en: "英文",
                          other: "其他",
                        } as const
                      )[field.value]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[
                    ["zh", "中文"],
                    ["ja", "日文"],
                    ["en", "英文"],
                    ["other", "其他"],
                  ].map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>
      <FormField
        id="font-sort"
        label="排序"
        error={form.formState.errors.sortOrder?.message}
        errorRole="alert"
      >
        {(props) => (
          <Input
            {...props}
            type="number"
            {...form.register("sortOrder", { valueAsNumber: true })}
          />
        )}
      </FormField>
      <FormField
        id="font-license"
        className="col-span-full"
        label="完整授权材料"
        error={form.formState.errors.licenseText?.message}
        errorRole="alert"
      >
        {(props) => (
          <Textarea {...props} rows={7} {...form.register("licenseText")} />
        )}
      </FormField>
      <div className="col-span-full flex flex-wrap gap-4">
        {[
          ["redistribution", "允许分发"],
          ["conversion", "允许转码"],
          ["subsetting", "允许分片"],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...form.register(
                `rights.${key as "redistribution" | "conversion" | "subsetting"}`,
              )}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
