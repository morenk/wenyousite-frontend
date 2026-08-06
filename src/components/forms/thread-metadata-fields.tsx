"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/forms/tag-input";
import type { ThreadCreateFormData } from "@/lib/validations/thread-create";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";

const CATEGORY_OPTIONS = [
  { value: "DEDUCTION", label: "演绎" },
  { value: "NATION", label: "国策" },
  { value: "RPG", label: "角色扮演" },
] as const;

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "公开" },
  { value: "PRIVATE", label: "私密" },
] as const;

const STATUS_OPTIONS = [
  { value: "RECRUITING", label: "招募中" },
  { value: "CLOSED", label: "已停招" },
  { value: "FINISHED", label: "已结束" },
] as const;

export function ThreadMetadataFields({
  form,
  disabled,
  showVisibility = true,
  status,
  onStatusChange,
}: {
  form: UseFormReturn<ThreadCreateFormData>;
  disabled: boolean;
  showVisibility?: boolean;
  status?: ThreadDetail["status"];
  onStatusChange?: (status: ThreadDetail["status"]) => void;
}) {
  const category = useWatch({ control: form.control, name: "category" });
  const visibility = useWatch({ control: form.control, name: "visibility" });
  const tagNames = useWatch({ control: form.control, name: "tagNames" });
  const tagError =
    form.formState.errors.tagNames?.message ??
    form.formState.errors.tagNames?.[0]?.message;

  return (
    <>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="title">主题帖标题</Label>
        <Input
          id="title"
          placeholder="给你的主题帖起个名字"
          disabled={disabled}
          aria-invalid={Boolean(form.formState.errors.title)}
          aria-describedby={form.formState.errors.title ? "title-error" : undefined}
          {...form.register("title")}
        />
        {form.formState.errors.title?.message && (
          <p id="title-error" className="text-sm text-destructive">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">分区</Label>
        <select
          id="category"
          value={category}
          onChange={(event) =>
            form.setValue(
              "category",
              event.target.value as ThreadCreateFormData["category"],
              { shouldDirty: true, shouldValidate: true },
            )
          }
          disabled={disabled}
          aria-invalid={Boolean(form.formState.errors.category)}
          className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {status !== undefined && onStatusChange && (
        <div className="space-y-2">
          <Label htmlFor="status">状态</Label>
          <select
            id="status"
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as ThreadDetail["status"])
            }
            disabled={disabled}
            className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      )}

      {showVisibility && (
        <div className="space-y-2">
          <Label htmlFor="visibility">可见性</Label>
          <select
            id="visibility"
            value={visibility}
            onChange={(event) =>
              form.setValue(
                "visibility",
                event.target.value as ThreadCreateFormData["visibility"],
                { shouldDirty: true, shouldValidate: true },
              )
            }
            disabled={disabled}
            className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="tags">标签</Label>
        <TagInput
          value={tagNames ?? []}
          onChange={(tags) =>
            form.setValue("tagNames", tags, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          disabled={disabled}
        />
        {tagError && <p className="text-sm text-destructive">{tagError}</p>}
      </div>
    </>
  );
}
