/** 单帖详情查询：为通知精确跳转提供主题、子贴和父楼上下文 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { PostData } from "@/api/hooks/use-floors";

export type PostDetail = PostData & {
  thread: { id: string; title: string };
  subthread: { id: string; title: string };
  parentPost: { id: string; floorNumber: number | null } | null;
};

interface PostResponse {
  code: number;
  message: string;
  data: PostDetail;
}

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
      return (data as unknown as PostResponse).data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}
