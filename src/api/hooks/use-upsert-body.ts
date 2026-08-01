/** 写入子贴正文 API hook（upsert：无正文创建，有正文乐观锁更新） */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface UpsertedBody {
  id: string;
  kind: "BODY" | "FLOOR";
  floorNumber: number | null;
  version: number;
  subthreadId: string;
  threadId: string;
  authorId: string;
  content: string;
}

interface UpsertBodyResponse {
  code: number;
  message: string;
  data: UpsertedBody;
}

export function useUpsertBody() {
  return useMutation({
    mutationFn: async ({
      subthreadId,
      content,
      version,
    }: {
      subthreadId: string;
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
      return (data as unknown as UpsertBodyResponse).data;
    },
  });
}
