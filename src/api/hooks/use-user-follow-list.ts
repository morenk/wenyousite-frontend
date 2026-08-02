/** 指定用户的关注/粉丝列表 API hook（GET /users/:id/following 或 /followers） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { PostAuthor } from "./use-floors";

export interface FollowUser {
  id: string;
  username: string;
  avatar: string | null;
}

export type FollowListKind = "following" | "followers";

interface UserFollowRecord {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
  following?: PostAuthor;
  follower?: PostAuthor;
}

interface UserFollowListResponse {
  code: number;
  message: string;
  data: UserFollowRecord[];
}

const listPath = {
  following: "/api/v1/users/{id}/following",
  followers: "/api/v1/users/{id}/followers",
} as const;

export function useUserFollowList(
  userId: string | undefined,
  kind: FollowListKind,
) {
  return useQuery({
    queryKey: ["user", kind, userId],
    queryFn: async () => {
      if (!userId) throw new Error("缺少用户 ID");
      const { data, error } = await apiClient.GET(listPath[kind], {
        params: { path: { id: userId } },
      });
      if (error) throw error;
      const response = data as unknown as UserFollowListResponse;
      const records = response?.data ?? [];
      return records
        .map((r) => r.following ?? r.follower)
        .filter((u): u is FollowUser => !!u);
    },
    enabled: !!userId,
    staleTime: 10 * 1000,
  });
}
