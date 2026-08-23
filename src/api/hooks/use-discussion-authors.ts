/** 讨论列表作者候选：服务端已按当前子贴或当前主楼层提前收窄范围。 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";

export type DiscussionAuthor = components["schemas"]["DiscussionAuthorResponseDto"];

type FloorAuthorListResponse = operations["postsFindFloorAuthors"]["responses"][200]["content"]["application/json"];
type ReplyAuthorListResponse = operations["postsFindReplyAuthors"]["responses"][200]["content"]["application/json"];

export function useFloorAuthors(subthreadId: string | undefined, userId?: string) {
  return useQuery({
    queryKey: queryKeys.floors.authors(subthreadId, userId ?? "anonymous"),
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/subthreads/{subthreadId}/posts/authors",
        { params: { path: { subthreadId: subthreadId! } } },
      );
      if (error) throw error;
      return (data?.data ?? []) satisfies FloorAuthorListResponse["data"];
    },
    enabled: !!subthreadId,
    staleTime: 20_000,
  });
}

export function useReplyAuthors(postId: string | undefined, userId?: string) {
  return useQuery({
    queryKey: queryKeys.replies.authors(postId, userId ?? "anonymous"),
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/posts/{id}/replies/authors",
        { params: { path: { id: postId! } } },
      );
      if (error) throw error;
      return (data?.data ?? []) satisfies ReplyAuthorListResponse["data"];
    },
    enabled: !!postId,
    staleTime: 20_000,
  });
}
