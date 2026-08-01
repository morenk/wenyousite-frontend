/** 用户公开资料 API hook（GET /users/:id，OptionalAuth） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface UserPublic {
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  role: string;
  showRecentReplies: boolean;
  showPlayerBadges: boolean;
  showBookmarks: boolean;
  createdAt: string;
  _count: { following: number; followers: number };
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  isBlocked?: boolean;
  isBlockedBy?: boolean;
  isDeactivated?: boolean;
}

interface UserResponse {
  code: number;
  message: string;
  data: UserPublic;
}

export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      if (!userId) throw new Error("缺少用户 ID");
      const { data, error } = await apiClient.GET("/api/v1/users/{id}", {
        params: { path: { id: userId } },
      });
      if (error) throw error;
      const response = data as unknown as UserResponse;
      if (!response?.data) {
        throw new Error("用户不存在");
      }
      return response.data;
    },
    enabled: !!userId,
    staleTime: 10 * 1000,
  });
}
