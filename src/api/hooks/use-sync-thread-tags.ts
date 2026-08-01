/** 同步主题帖标签 API hook（diff 后添加/移除，仅 OWNER/COLLABORATOR） */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { ThreadTag } from "./use-thread-detail";

export interface SyncThreadTagsArgs {
  threadId: string;
  existingTags: ThreadTag[];
  targetNames: string[];
}

export function useSyncThreadTags() {
  return useMutation({
    mutationFn: async ({
      threadId,
      existingTags,
      targetNames,
    }: SyncThreadTagsArgs) => {
      const existingNames = existingTags.map((t) => t.name);
      const existingById = new Map(existingTags.map((t) => [t.name, t.id]));

      // 需要新增的标签
      const toAdd = targetNames.filter((name) => !existingNames.includes(name));
      for (const name of toAdd) {
        const { error } = await apiClient.POST("/api/v1/threads/{threadId}/tags", {
          params: { path: { threadId } },
          body: { name },
        });
        if (error) throw error;
      }

      // 需要移除的标签
      const toRemove = existingTags.filter((t) => !targetNames.includes(t.name));
      for (const tag of toRemove) {
        const id = existingById.get(tag.name);
        if (!id) continue;
        const { error } = await apiClient.DELETE(
          "/api/v1/threads/{threadId}/tags/{tagId}",
          {
            params: { path: { threadId, tagId: id } },
          },
        );
        if (error) throw error;
      }
    },
  });
}
