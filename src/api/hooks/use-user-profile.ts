/** 用户公开资料 API hook（GET /users/:id，OptionalAuth） */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { BROWSING_RETURN_GC_TIME } from "@/api/query-policy";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
import { useViewerScope } from "@/api/use-viewer-scope";

type GeneratedUserPublic =
  components["schemas"]["PublicUserResponseDto"];
type ActiveUserFields =
  | "avatar"
  | "bio"
  | "role"
  | "level"
  | "receivedTipTotal"
  | "receivedTipCount"
  | "showRecentReplies"
  | "showPlayerBadges"
  | "showBookmarks"
  | "accountStatus"
  | "createdAt"
  | "_count";

export type ActiveUserPublic = GeneratedUserPublic &
  Required<Pick<GeneratedUserPublic, ActiveUserFields>> & {
    isDeactivated?: false;
  };
export type DeactivatedUserPublic = Pick<
  GeneratedUserPublic,
  "id" | "username"
> & { isDeactivated: true };
export type UserPublic = ActiveUserPublic | DeactivatedUserPublic;

function normalizeUserPublic(user: GeneratedUserPublic): UserPublic {
  if (user.isDeactivated) {
    return { id: user.id, username: user.username, isDeactivated: true };
  }
  if (
    user.avatar === undefined ||
    user.bio === undefined ||
    user.role === undefined ||
    user.level === undefined ||
    user.receivedTipTotal === undefined ||
    user.receivedTipCount === undefined ||
    user.showRecentReplies === undefined ||
    user.showPlayerBadges === undefined ||
    user.showBookmarks === undefined ||
    user.accountStatus === undefined ||
    user.createdAt === undefined ||
    user._count === undefined
  ) {
    throw new Error("用户资料响应不完整");
  }
  return {
    ...user,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
    level: user.level,
    receivedTipTotal: user.receivedTipTotal,
    receivedTipCount: user.receivedTipCount,
    showRecentReplies: user.showRecentReplies,
    showPlayerBadges: user.showPlayerBadges,
    showBookmarks: user.showBookmarks,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
    _count: user._count,
    isDeactivated: false,
  };
}

export function useUserProfile(userId: string | undefined) {
  const viewerScope = useViewerScope();
  return useQuery({
    queryKey: queryKeys.users.detailForViewer(userId, viewerScope),
    queryFn: async () => {
      if (!userId) throw new Error("缺少用户 ID");
      const { data, error } = await apiClient.GET("/api/v1/users/{id}", {
        params: { path: { id: userId } },
      });
      if (error) throw error;
      if (!data) {
        throw new Error("用户不存在");
      }
      return normalizeUserPublic(data.data);
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: BROWSING_RETURN_GC_TIME,
  });
}
