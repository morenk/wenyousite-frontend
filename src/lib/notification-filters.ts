import {
  NOTIFICATION_ALL_LABEL,
  NOTIFICATION_GROUPS,
} from "@wenyousite/foundation/notifications";

export interface NotificationFilterOption {
  id: "all" | (typeof NOTIFICATION_GROUPS)[number]["id"];
  label: string;
  value: string | undefined;
}

export const NOTIFICATION_FILTERS: readonly NotificationFilterOption[] = [
  { id: "all", label: NOTIFICATION_ALL_LABEL, value: undefined },
  ...NOTIFICATION_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    value: group.types.join(","),
  })),
];

const canonicalValues = new Set(
  NOTIFICATION_FILTERS.flatMap((filter) => filter.value ? [filter.value] : []),
);
const valueByGroupId = new Map(
  NOTIFICATION_FILTERS.flatMap((filter) => filter.value ? [[filter.id, filter.value]] : []),
);

const legacyAliases: Readonly<Record<string, string | undefined>> = {
  "reply,mention": valueByGroupId.get("interaction"),
  "follow,like": valueByGroupId.get("interaction"),
  "tip,level_up": valueByGroupId.get("system"),
  system: valueByGroupId.get("system"),
};

/** 将历史通知筛选链接归并到 Foundation 当前分组；非法值回退全部。 */
export function normalizeNotificationFilter(value: string): string | null {
  if (canonicalValues.has(value)) return value;
  return legacyAliases[value] ?? null;
}
