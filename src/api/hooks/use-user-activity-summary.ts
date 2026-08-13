/** 用户主页创作汇总（GET /users/:id/activity-summary）。 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { BROWSING_RETURN_GC_TIME } from "@/api/query-policy";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
import { useViewerScope } from "@/api/use-viewer-scope";

export type UserActivitySummary = components["schemas"]["UserActivitySummaryResponseDto"];

export function useUserActivitySummary(userId: string | undefined) {
  const viewerScope = useViewerScope();
  return useQuery({
    queryKey: queryKeys.users.activitySummaryForViewer(userId, viewerScope),
    queryFn: async () => {
      if (!userId) throw new Error("缺少用户 ID");
      const { data, error } = await apiClient.GET(
        "/api/v1/users/{id}/activity-summary",
        { params: { path: { id: userId } } },
      );
      if (error) throw error;
      if (!data?.data) throw new Error("用户活动汇总响应为空");
      return data.data;
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: BROWSING_RETURN_GC_TIME,
  });
}
