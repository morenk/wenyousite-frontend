import type { QueryClient } from "@tanstack/react-query";
import type { components } from "./types";
import { queryKeys } from "./query-keys";

/** 读取能力由已成功加载的meta确认；新写开关只限制新增节点，不阻止保留/删除旧源。 */
export function markdownWriteCapability(client: QueryClient) {
  const meta = client.getQueryData<components["schemas"]["ApiMetaResponseDto"]>(queryKeys.meta);
  // undefined 也保留为自有字段，冻结请求可覆盖重试时新加载的能力；JSON 仍省略它。
  return meta?.capabilities?.roleMentionsV6Supported ? { markdownContractVersion: 6 as const } : { markdownContractVersion: undefined };
}
