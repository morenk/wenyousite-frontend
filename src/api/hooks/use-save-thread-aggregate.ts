/** 原子保存主题帖编辑器聚合数据。 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateChangedMentionCandidates } from "./use-mention-candidates";
import { markdownWriteCapability } from "@/api/markdown-capability";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import { useViewerScope } from "@/api/use-viewer-scope";
import type { operations } from "@/api/types";
import { normalizeThreadDetail } from "./use-thread-detail";
import { watchPostWriteSession } from "@/api/post-write-cache";

export type SaveThreadAggregateBody =
  operations["threadsSaveAggregate"]["requestBody"]["content"]["application/json"];

export function useSaveThreadAggregate() {
  const queryClient = useQueryClient();
  const viewerScope = useViewerScope();
  return useMutation({
    onMutate: () => ({ ...watchPostWriteSession(), viewerScope }),
    mutationFn: async ({
      threadId,
      body,
    }: {
      threadId: string;
      body: SaveThreadAggregateBody;
    }) => {
      const { data, error } = await apiClient.PATCH(
        "/api/v1/threads/{id}/aggregate",
        {
          params: { path: { id: threadId } },
          body: { ...markdownWriteCapability(queryClient), ...body },
        },
      );
      if (error) throw error;
      if (!data) throw new Error("保存主题帖响应为空");
      return normalizeThreadDetail(data.data);
    },
    onError: (error) => invalidateChangedMentionCandidates(queryClient, error),
    onSuccess: async (thread, _variables, context) => {
      if (!context.isCurrent()) return;
      const key = queryKeys.threads.detailForViewer(thread.id, context.viewerScope);
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      if (!context.isCurrent()) return;
      // 发言能力属于当前访问者，不能把管理者的响应写入其他身份缓存。
      queryClient.setQueryData(
        key,
        (old: typeof thread | undefined) => old && old.version > thread.version ? old : thread,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(thread.id), refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.threadDrafts });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
    onSettled: (_data, _error, _variables, context) => context?.dispose(),
  });
}
