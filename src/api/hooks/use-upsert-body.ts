/** 写入子贴正文 API hook（upsert：无正文创建，有正文乐观锁更新） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type UpsertedBody = components["schemas"]["PostResponseDto"];

export function useUpsertBody() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      subthreadId,
      content,
      version,
    }: {
      subthreadId: string;
      threadId: string;
      content: string;
      version?: number;
    }) => {
      const { data, error } = await apiClient.PUT(
        "/api/v1/subthreads/{subthreadId}/body",
        {
          params: { path: { subthreadId } },
          body: { content, version },
        },
      );
      if (error) throw error;
      if (!data) throw new Error("保存正文响应为空");
      return data.data;
    },
    onSuccess: (_data, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.floors.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.threads.detail(variables.threadId),
        }),
      ]),
  });
}
