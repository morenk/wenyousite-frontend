/** 指定用户的关注/粉丝列表 API hook（GET /users/:id/following 或 /followers） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export interface FollowUser {
  id: string;
  username: string;
  avatar: string | null;
}

export type FollowListKind = "following" | "followers";

type UserFollowRecord =
  components["schemas"]["UserFollowRecordResponseDto"];

export function useUserFollowList(
  userId: string | undefined,
  kind: FollowListKind,
) {
  return useQuery({
    queryKey: queryKeys.users.followLists(kind, userId),
    queryFn: async () => {
      if (!userId) throw new Error("缺少用户 ID");
      const requestOptions = { params: { path: { id: userId } } } as const;
      const { data, error } = kind === "following"
        ? await apiClient.GET("/api/v1/users/{id}/following", requestOptions)
        : await apiClient.GET("/api/v1/users/{id}/followers", requestOptions);
      if (error) throw error;
      const records: UserFollowRecord[] = data?.data ?? [];
      return records
        .map((r) => r.following ?? r.follower)
        .filter((u): u is FollowUser => !!u);
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}
