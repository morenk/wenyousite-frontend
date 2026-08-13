import { parseAsString, parseAsStringLiteral } from "nuqs";

export const MANAGEMENT_VIEWS = ["settings", "subthreads", "members"] as const;

export type ManagementView = (typeof MANAGEMENT_VIEWS)[number];

/** 已发布主题帖管理页的稳定 URL 状态。 */
export const managementUrlParsers = {
  view: parseAsStringLiteral(MANAGEMENT_VIEWS).withDefault("settings"),
  subthread: parseAsString,
};
