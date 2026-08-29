/** 按需定位主题帖内最新发布的有效楼层或楼中楼回复。 */

import { useMutation } from "@tanstack/react-query";

import { apiClient } from "@/api/client";
import type { components } from "@/api/types";

export type LatestThreadPost =
  components["schemas"]["LatestThreadPostResponseDto"];

export function useLatestThreadPost() {
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { data, error } = await apiClient.GET(
        "/api/v1/threads/{threadId}/posts/latest",
        { params: { path: { threadId } } },
      );
      if (error) throw error;
      if (!data) throw new Error("最新发言响应为空");
      return data.data;
    },
  });
}
