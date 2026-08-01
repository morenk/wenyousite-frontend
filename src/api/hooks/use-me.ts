/** 我的完整资料 API hook（GET /users/me） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface UserMe {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  role: string;
  showRecentReplies: boolean;
  showPlayerBadges: boolean;
  showBookmarks: boolean;
  emailVerified: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { following: number; followers: number };
}

interface MeResponse {
  code: number;
  message: string;
  data: UserMe;
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/users/me");
      if (error) throw error;
      const response = data as unknown as MeResponse;
      if (!response?.data) throw new Error("获取资料失败");
      return response.data;
    },
    staleTime: 10 * 1000,
  });
}
