"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagInput } from "@/components/forms/tag-input";
import type { ThreadCreateFormData } from "@/lib/validations/thread-create";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import { useThreadCategoriesContext } from "@/components/thread/thread-categories-provider";
import {
  THREAD_STATUS_OPTIONS,
  THREAD_VISIBILITY_OPTIONS,
} from "@/lib/thread-presentation";

const UNSELECTED_CATEGORY = "__UNSELECTED_CATEGORY__";

export function ThreadMetadataFields({
  form,
  disabled,
  showVisibility = true,
  visibilityReadOnly = false,
  sections = "all",
  status,
  onStatusChange,
}: {
  form: UseFormReturn<ThreadCreateFormData>;
  disabled: boolean;
  showVisibility?: boolean;
  visibilityReadOnly?: boolean;
  sections?: "all" | "identity" | "publication";
  status?: ThreadDetail["status"];
  onStatusChange?: (status: ThreadDetail["status"]) => void;
}) {
  const {
    categories,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useThreadCategoriesContext();
  const category = useWatch({ control: form.control, name: "category" });
  const visibility = useWatch({ control: form.control, name: "visibility" });
  const tagNames = useWatch({ control: form.control, name: "tagNames" });
  const tagError =
    form.formState.errors.tagNames?.message ??
    form.formState.errors.tagNames?.[0]?.message;
  const currentCategoryUnavailable = Boolean(
    category && !categories.some((option) => option.slug === category),
  );
  const categoryItems = [
    {
      value: UNSELECTED_CATEGORY,
      label: categoriesLoading ? "正在加载分区…" : "请选择分区",
    },
    ...(currentCategoryUnavailable && category
      ? [{ value: category, label: `${category}（已停用或不可用）` }]
      : []),
    ...categories.map((option) => ({ value: option.slug, label: option.name })),
  ];
  const showIdentity = sections === "all" || sections === "identity";
  const showPublication = sections === "all" || sections === "publication";

  return (
    <>
      {showIdentity ? <div className="space-y-2 sm:col-span-2">
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
      </div> : null}

      {showPublication ? <div className="space-y-2">
        <Label htmlFor="category">分区</Label>
        <Select
          items={categoryItems}
          value={category ?? UNSELECTED_CATEGORY}
          onValueChange={(value) =>
            form.setValue(
              "category",
              value === UNSELECTED_CATEGORY
                ? undefined
                : value as ThreadCreateFormData["category"],
              { shouldDirty: true, shouldValidate: true },
            )
          }
          disabled={disabled || categoriesLoading || categoriesError}
        >
          <SelectTrigger
            id="category"
            className="w-full"
            aria-invalid={Boolean(form.formState.errors.category)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {categoryItems.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.value === UNSELECTED_CATEGORY || (currentCategoryUnavailable && option.value === category)}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categoriesError ? (
          <p className="text-sm text-destructive">
            分区加载失败。{" "}
            <button type="button" className="font-semibold underline" onClick={refetchCategories}>
              重试
            </button>
          </p>
        ) : null}
        {!categoriesLoading && !categoriesError && categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前没有可用分区。</p>
        ) : null}
        {form.formState.errors.category?.message ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.category.message}
          </p>
        ) : null}
      </div> : null}

      {showPublication && status !== undefined && onStatusChange && (
        <div className="space-y-2">
          <Label htmlFor="status">状态</Label>
          <Select
            items={THREAD_STATUS_OPTIONS}
            value={status}
            onValueChange={(value) =>
              onStatusChange(value as ThreadDetail["status"])
            }
            disabled={disabled}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {THREAD_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showPublication && showVisibility && (
        <div className="space-y-2">
          <Label htmlFor="visibility">可见性</Label>
          <Select
            items={THREAD_VISIBILITY_OPTIONS}
            value={visibility}
            onValueChange={(value) =>
              form.setValue(
                "visibility",
                value as ThreadCreateFormData["visibility"],
                { shouldDirty: true, shouldValidate: true },
              )
            }
            disabled={disabled || visibilityReadOnly}
          >
            <SelectTrigger id="visibility" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {THREAD_VISIBILITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {visibilityReadOnly ? (
            <p className="text-xs leading-5 text-muted-foreground">
              当前可见性由楼主管理，协作者只能查看。
            </p>
          ) : null}
        </div>
      )}

      {showIdentity ? <div className="space-y-2 sm:col-span-2">
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
      </div> : null}
    </>
  );
}
