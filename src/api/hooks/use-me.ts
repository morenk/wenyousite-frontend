/** 我的完整资料 API hook（GET /users/me） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export type UserMe = components["schemas"]["CurrentUserResponseDto"];

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/users/me");
      if (error) throw error;
      if (!data) throw new Error("获取资料失败");
      return data.data;
    },
    staleTime: 10 * 1000,
  });
}
