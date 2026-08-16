import { METADATA_ELEMENT_STYLES } from "@wenyousite/foundation/elements";

import type { ThreadCategoryDefinition } from "@/api/hooks/use-thread-categories";
import type { components } from "@/api/types";
import type { BadgeTone } from "@/lib/presentation-types";

export type ThreadCategory = NonNullable<
  components["schemas"]["HomeThreadListItemResponseDto"]["category"]
>;
export type ThreadStatus = components["schemas"]["HomeThreadListItemResponseDto"]["status"];
export type ThreadVisibility = components["schemas"]["HomeThreadListItemResponseDto"]["visibility"];

export function getThreadCategoryPresentation(
  slug: string | null | undefined,
  categories: Pick<ThreadCategoryDefinition, "slug" | "name">[],
): {
  label: string;
  badgeTone: BadgeTone;
} {
  const definition = slug
    ? categories.find((category) => category.slug === slug)
    : undefined;

  return {
    label: definition?.name ?? slug ?? "未分类",
    badgeTone: METADATA_ELEMENT_STYLES.categoryMarker.badgeTone,
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
