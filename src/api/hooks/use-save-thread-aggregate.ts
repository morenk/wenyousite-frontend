/** 原子保存主题帖编辑器聚合数据。 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { operations } from "@/api/types";
import { normalizeThreadDetail } from "./use-thread-detail";

export type SaveThreadAggregateBody =
  operations["threadsSaveAggregate"]["requestBody"]["content"]["application/json"];

export function useSaveThreadAggregate() {
  const queryClient = useQueryClient();
  return useMutation({
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
          body,
        },
      );
      if (error) throw error;
      if (!data) throw new Error("保存主题帖响应为空");
      return normalizeThreadDetail(data.data);
    },
    onSuccess: (thread) => {
      queryClient.setQueriesData(
        { queryKey: queryKeys.threads.detail(thread.id) },
        thread,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.threadDrafts });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
