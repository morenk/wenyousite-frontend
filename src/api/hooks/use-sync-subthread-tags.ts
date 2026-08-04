/** 同步子贴标签 API hook（按名称 diff 后添加/移除） */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { ThreadTag } from "./use-thread-detail";

export interface SyncSubthreadTagsArgs {
  subthreadId: string;
  existingTags: ThreadTag[];
  targetNames: string[];
}

export function useSyncSubthreadTags() {
  return useMutation({
    mutationFn: async ({
      subthreadId,
      existingTags,
      targetNames,
    }: SyncSubthreadTagsArgs) => {
      const existingNames = new Set(existingTags.map((tag) => tag.name));
      const targetNameSet = new Set(targetNames);

      for (const name of targetNames) {
        if (existingNames.has(name)) continue;
        const { error } = await apiClient.POST(
          "/api/v1/subthreads/{subthreadId}/tags",
          {
            params: { path: { subthreadId } },
            body: { name },
          },
        );
        if (error) throw error;
      }

      for (const tag of existingTags) {
        if (targetNameSet.has(tag.name)) continue;
        const { error } = await apiClient.DELETE(
          "/api/v1/subthreads/{subthreadId}/tags/{tagId}",
          {
            params: { path: { subthreadId, tagId: tag.id } },
          },
        );
        if (error) throw error;
      }
    },
  });
}
