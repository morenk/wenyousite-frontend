import type { components } from "@/api/types";

export type ThreadCategory = components["schemas"]["HomeThreadListItemResponseDto"]["category"];
export type ThreadStatus = components["schemas"]["HomeThreadListItemResponseDto"]["status"];
export type ThreadVisibility = components["schemas"]["HomeThreadListItemResponseDto"]["visibility"];

export const THREAD_CATEGORY_META: Record<
  ThreadCategory,
  { label: string; badgeClassName: string }
> = {
  DEDUCTION: {
    label: "演绎",
    badgeClassName: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  NATION: {
    label: "国策",
    badgeClassName: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  RPG: {
    label: "RPG",
    badgeClassName: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
};

export const THREAD_STATUS_META: Record<
  ThreadStatus,
  { label: string; badgeClassName: string }
> = {
  RECRUITING: {
    label: "招募中",
    badgeClassName: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  CLOSED: {
    label: "已停招",
    badgeClassName: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
  FINISHED: {
    label: "已结束",
    badgeClassName: "bg-muted text-muted-foreground",
  },
};

export const THREAD_CATEGORY_OPTIONS = (Object.entries(THREAD_CATEGORY_META) as Array<
  [ThreadCategory, (typeof THREAD_CATEGORY_META)[ThreadCategory]]
>).map(([value, meta]) => ({ value, label: meta.label }));

export const THREAD_STATUS_OPTIONS = (Object.entries(THREAD_STATUS_META) as Array<
  [ThreadStatus, (typeof THREAD_STATUS_META)[ThreadStatus]]
>).map(([value, meta]) => ({ value, label: meta.label }));

export const THREAD_VISIBILITY_OPTIONS: Array<{ value: ThreadVisibility; label: string }> = [
  { value: "PUBLIC", label: "公开" },
  { value: "PRIVATE", label: "私密" },
];
