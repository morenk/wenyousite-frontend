import type { CSSProperties } from "react";

import type { ThreadCategoryDefinition } from "@/api/hooks/use-thread-categories";
import type { components } from "@/api/types";
import type { BadgeTone } from "@/components/ui/badge";

export type ThreadCategory = NonNullable<
  components["schemas"]["HomeThreadListItemResponseDto"]["category"]
>;
export type ThreadStatus = components["schemas"]["HomeThreadListItemResponseDto"]["status"];
export type ThreadVisibility = components["schemas"]["HomeThreadListItemResponseDto"]["visibility"];

const LEGACY_THREAD_CATEGORY_META: Record<
  string,
  { label: string; badgeTone: BadgeTone; markerClassName: string }
> = {
  DEDUCTION: {
    label: "演绎",
    badgeTone: "deduction",
    markerClassName: "bg-category-deduction",
  },
  NATION: {
    label: "国策",
    badgeTone: "nation",
    markerClassName: "bg-category-nation",
  },
  RPG: {
    label: "RPG",
    badgeTone: "rpg",
    markerClassName: "bg-category-rpg",
  },
};

export const LEGACY_THREAD_CATEGORIES: ThreadCategoryDefinition[] = [
  { id: "legacy_deduction", slug: "DEDUCTION", name: "演绎", description: null, color: null, icon: null, sortOrder: 10, isActive: true, createdAt: "1970-01-01T00:00:00.000Z", updatedAt: "1970-01-01T00:00:00.000Z" },
  { id: "legacy_nation", slug: "NATION", name: "国策", description: null, color: null, icon: null, sortOrder: 20, isActive: true, createdAt: "1970-01-01T00:00:00.000Z", updatedAt: "1970-01-01T00:00:00.000Z" },
  { id: "legacy_rpg", slug: "RPG", name: "RPG", description: null, color: null, icon: null, sortOrder: 30, isActive: true, createdAt: "1970-01-01T00:00:00.000Z", updatedAt: "1970-01-01T00:00:00.000Z" },
];

function normalizeCategoryColor(color: string | null | undefined) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : null;
}

export function getThreadCategoryPresentation(
  slug: string | null | undefined,
  categories: Pick<ThreadCategoryDefinition, "slug" | "name" | "color">[],
): {
  label: string;
  badgeTone: BadgeTone;
  badgeStyle?: CSSProperties;
  markerClassName: string;
  markerStyle?: CSSProperties;
} {
  const definition = slug
    ? categories.find((category) => category.slug === slug)
    : undefined;
  const legacy = slug ? LEGACY_THREAD_CATEGORY_META[slug] : undefined;
  const color = normalizeCategoryColor(definition?.color);

  return {
    label: definition?.name ?? legacy?.label ?? slug ?? "未分类",
    badgeTone: color ? "neutral" : legacy?.badgeTone ?? "neutral",
    badgeStyle: color
      ? {
          backgroundColor: `${color}1F`,
          boxShadow: `inset 0 0 0 1px ${color}55`,
          color: "var(--foreground)",
        }
      : undefined,
    markerClassName: color
      ? ""
      : legacy?.markerClassName ?? "bg-muted-foreground",
    markerStyle: color ? { backgroundColor: color } : undefined,
  };
}

export const THREAD_STATUS_META: Record<
  ThreadStatus,
  { label: string; badgeTone: BadgeTone }
> = {
  RECRUITING: {
    label: "招募中",
    badgeTone: "success",
  },
  CLOSED: {
    label: "已停招",
    badgeTone: "neutral",
  },
  FINISHED: {
    label: "已结束",
    badgeTone: "neutral",
  },
};

export const THREAD_STATUS_OPTIONS = (Object.entries(THREAD_STATUS_META) as Array<
  [ThreadStatus, (typeof THREAD_STATUS_META)[ThreadStatus]]
>).map(([value, meta]) => ({ value, label: meta.label }));

export const THREAD_VISIBILITY_OPTIONS: Array<{ value: ThreadVisibility; label: string }> = [
  { value: "PUBLIC", label: "公开" },
  { value: "PRIVATE", label: "私密" },
];
