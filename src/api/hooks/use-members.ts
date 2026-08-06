/** 主题帖参与人列表 API hook */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type ThreadMember = components["schemas"]["ThreadMemberResponseDto"];

export function useMembers(threadId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.members.list(threadId),
    queryFn: async () => {
      if (!threadId) throw new Error("缺少主题帖 ID");
      const { data, error } = await apiClient.GET(
        "/api/v1/threads/{threadId}/members",
        { params: { path: { threadId } } },
      );
      if (error) throw error;
      if (!data) throw new Error("参与人列表响应为空");
      return data.data;
    },
    enabled: !!threadId,
    staleTime: 5 * 1000,
  });
}
