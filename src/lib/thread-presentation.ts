import type { CSSProperties } from "react";

import type { ThreadCategoryDefinition } from "@/api/hooks/use-thread-categories";
import type { components } from "@/api/types";
import type { BadgeTone } from "@/lib/presentation-types";

export type ThreadCategory = NonNullable<
  components["schemas"]["HomeThreadListItemResponseDto"]["category"]
>;
export type ThreadStatus = components["schemas"]["HomeThreadListItemResponseDto"]["status"];
export type ThreadVisibility = components["schemas"]["HomeThreadListItemResponseDto"]["visibility"];

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
  const color = normalizeCategoryColor(definition?.color);

  return {
    label: definition?.name ?? slug ?? "未分类",
    badgeTone: "neutral",
    badgeStyle: color
      ? {
          backgroundColor: `${color}1F`,
          boxShadow: `inset 0 0 0 1px ${color}55`,
          color: "var(--foreground)",
        }
      : undefined,
    markerClassName: color ? "" : "bg-muted-foreground",
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
