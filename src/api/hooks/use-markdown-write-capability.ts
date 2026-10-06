import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { markdownWriteCapability } from "@/api/markdown-capability";

/** 发言开始时捕获一次能力；UI把结果与正文一起冻结，不参与缓存编排。 */
export function useMarkdownWriteCapability() {
  const client = useQueryClient();
  return useCallback(() => markdownWriteCapability(client), [client]);
}
