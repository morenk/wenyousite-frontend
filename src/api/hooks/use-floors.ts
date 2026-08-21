/** 楼层列表 API hook（cursor 分页） */

import { useCallback } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import { DEFAULT_FLOOR_ORDER, type FloorOrder } from "@/api/floor-query";
import type { components, operations } from "@/api/types";

export type PostAuthor = components["schemas"]["PostAuthorResponseDto"];
export type ReplyToTarget = components["schemas"]["ReplyTargetResponseDto"];
type DiceRoll = components["schemas"]["DiceRollResponseDto"];
type CompatiblePost<T> = Omit<T, "diceRolls"> & {
  diceRolls?: DiceRoll[];
};
export type ReplyData = CompatiblePost<components["schemas"]["ReplyResponseDto"]>;
export type PostData = CompatiblePost<components["schemas"]["FloorResponseDto"]>;
export type FloorDisplayData = CompatiblePost<components["schemas"]["PostResponseDto"]> & {
  _count: components["schemas"]["PostCountResponseDto"];
  replies?: ReplyData[];
};
export type ReplyDisplayData = CompatiblePost<components["schemas"]["PostResponseDto"]> & {
  replyToPost?: ReplyData["replyToPost"];
};
export type FloorListResponse = operations["postsFindFloors"]["responses"][200]["content"]["application/json"];

export const FLOORS_STALE_TIME = 30 * 1000;

export function floorsQueryOptions(
  subthreadId: string,
  order: FloorOrder = DEFAULT_FLOOR_ORDER,
) {
  return {
    queryKey: queryKeys.floors.list(subthreadId, { order }),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const queryParams = {
        limit: 20,
        order,
        ...(pageParam ? { cursor: pageParam } : {}),
      };

      const { data, error } = await apiClient.GET(
        "/api/v1/subthreads/{subthreadId}/posts",
        {
          params: { path: { subthreadId }, query: queryParams },
        },
      );
      if (error) throw error;

      if (!data?.data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } satisfies FloorListResponse;
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: FloorListResponse) => {
      if (!lastPage?.meta?.hasMore) return undefined;
      return lastPage.meta.cursor ?? undefined;
    },
    staleTime: FLOORS_STALE_TIME,
  };
}

export function useFloors(
  subthreadId: string | undefined,
  order: FloorOrder = DEFAULT_FLOOR_ORDER,
) {
  return useInfiniteQuery({
    ...floorsQueryOptions(subthreadId ?? "", order),
    enabled: !!subthreadId,
  });
}

/** 预取子贴首屏楼层；调用方只表达阅读意图，不直接编排 QueryClient。 */
export function usePrefetchFloors(
  order: FloorOrder = DEFAULT_FLOOR_ORDER,
) {
  const queryClient = useQueryClient();
  return useCallback((subthreadId: string) => {
    if (!subthreadId) return;
    void queryClient.prefetchInfiniteQuery(
      floorsQueryOptions(subthreadId, order),
    );
  }, [order, queryClient]);
}
