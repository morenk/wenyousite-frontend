/** 关系列表使用查看者维度，保留服务端给出的两个方向，未知不归一为 false。 */

import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
import { useViewerScope } from "@/api/use-viewer-scope";

export interface FollowUser {
  avatarDisplay?: components["schemas"]["MediaDisplayResponseDto"] | null;
  id: string;
  username: string;
  avatar: string | null;
  level: number;
  viewerIsFollowing?: boolean;
  viewerIsFollowedBy?: boolean;
}

export type FollowListKind = "following" | "followers";

export function followListOptions(userId: string | undefined, kind: FollowListKind, viewerScope: string) {
  return queryOptions({
    queryKey: queryKeys.users.followListsForViewer(kind, userId, viewerScope),
    queryFn: async ({ signal }): Promise<FollowUser[]> => {
      if (!userId) throw new Error("缺少用户 ID");
      const requestOptions = {
        params: { path: { id: userId } },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      };
      const { data, error } = kind === "following"
        ? await apiClient.GET("/api/v1/users/{id}/following", requestOptions)
        : await apiClient.GET("/api/v1/users/{id}/followers", requestOptions);
      if (error) throw error;
      if (!data) throw new Error("关系响应不完整");
      return data.data.flatMap((record) => {
        const user = kind === "following" ? record.following : record.follower;
        return user ? [{
          ...user,
          viewerIsFollowing: record.viewerIsFollowing,
          viewerIsFollowedBy: record.viewerIsFollowedBy,
        }] : [];
      });
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function useUserFollowList(userId: string | undefined, kind: FollowListKind) {
  const viewerScope = useViewerScope();
  return useQuery(followListOptions(userId, kind, viewerScope));
}
