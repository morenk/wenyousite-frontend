/** 楼层列表 API hook（cursor 分页） */

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
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
export type FloorListResponse = operations["PostsController_findFloors"]["responses"][200]["content"]["application/json"];

export function useFloors(subthreadId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["floors", subthreadId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!subthreadId) throw new Error("缺少子贴 ID");
      const queryParams: Record<string, string> = { limit: "20" };
      if (pageParam) queryParams.cursor = pageParam;

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
    getNextPageParam: (lastPage) => {
      if (!lastPage?.meta?.hasMore) return undefined;
      return lastPage.meta.cursor ?? undefined;
    },
    enabled: !!subthreadId,
    staleTime: 5 * 1000,
  });
}
