/** 更新主题帖 / 发布 API hook */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { ThreadCreateFormData } from "@/lib/validations/thread-create";
import { normalizeThreadDetail } from "./use-thread-detail";

export interface UpdateThreadBody {
  title?: ThreadCreateFormData["title"];
  category?: ThreadCreateFormData["category"];
  status?: "RECRUITING" | "CLOSED" | "FINISHED";
  visibility?: ThreadCreateFormData["visibility"];
  published?: boolean;
  version: number;
}

export function useUpdateThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      threadId,
      body,
    }: {
      threadId: string;
      body: UpdateThreadBody;
    }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/threads/{id}", {
        params: { path: { id: threadId } },
        body: {
          title: body.title,
          category: body.category,
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
          published: body.published,
          version: body.version,
        },
      });
      if (error) throw error;
      if (!data) throw new Error("更新主题帖响应为空");
      return normalizeThreadDetail(data.data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}
