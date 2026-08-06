/** 单帖详情查询：为通知精确跳转提供主题、子贴和父楼上下文 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/types";

type GeneratedPostDetail = components["schemas"]["PostDetailResponseDto"];
export type PostDetail = Omit<GeneratedPostDetail, "diceRolls"> & {
  diceRolls?: components["schemas"]["DiceRollResponseDto"][];
};

/** 查询一个未删除且当前用户可访问的帖子 */
export function usePost(id?: string) {
  return useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      if (!id) throw new Error("缺少帖子 ID");
      const { data, error } = await apiClient.GET("/api/v1/posts/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
      if (!data) throw new Error("帖子详情响应为空");
      return data.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}
