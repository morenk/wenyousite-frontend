import { METADATA_ELEMENT_STYLES } from "@wenyousite/foundation/elements";

import type { components } from "@/api/types";
import type { BadgeTone } from "@/lib/presentation-types";

export type ThreadCategory = NonNullable<
  components["schemas"]["ThreadListItemResponseDto"]["category"]
>;
export type ThreadCategoryInfo = components["schemas"]["ThreadCategoryInfoDto"];
export type ThreadStatus = components["schemas"]["ThreadListItemResponseDto"]["status"];
export type ThreadVisibility = components["schemas"]["ThreadListItemResponseDto"]["visibility"];

export function getThreadCategoryPresentation(
  categoryInfo: ThreadCategoryInfo | null | undefined,
  fallbackSlug?: string | null,
): {
  label: string;
  badgeTone: BadgeTone;
} {
  return {
    label: categoryInfo?.name ?? fallbackSlug ?? "未分类",
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
