/** 用户最近动态 API hook（GET /users/:id/recent-replies，固定 10 条不分页） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface RecentReply {
  id: string;
  createdAt: string;
  floorNumber: number | null;
  parentPostId: string | null;
  content: string;
  threadId: string;
  thread: { title: string };
  subthreadId: string;
  subthread: { title: string };
  preview: string;
}

interface RecentRepliesResponse {
  code: number;
  message: string;
  data: RecentReply[];
}

export function useUserRecentReplies(userId: string | undefined) {
  return useQuery({
    queryKey: ["user", "recent-replies", userId],
    queryFn: async () => {
      if (!userId) throw new Error("缺少用户 ID");
      const { data, error } = await apiClient.GET(
        "/api/v1/users/{id}/recent-replies",
        { params: { path: { id: userId } } },
      );
      if (error) throw error;
      const response = data as unknown as RecentRepliesResponse;
      return response?.data ?? [];
    },
    enabled: !!userId,
    staleTime: 10 * 1000,
  });
}
