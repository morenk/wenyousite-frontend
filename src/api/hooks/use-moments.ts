import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import { BROWSING_RETURN_GC_TIME } from "@/api/query-policy";
import type { components, operations } from "@/api/types";
import { isMomentCacheQuery, patchMomentCaches } from "@/api/moment-cache";
import type { ReplyFilters } from "@/api/reply-query";

export type MomentCard = components["schemas"]["MomentCardResponseDto"];
export type MomentDetail = components["schemas"]["MomentDetailResponseDto"];
export type MomentComment = components["schemas"]["MomentCommentResponseDto"];
export type MomentRootComment = components["schemas"]["MomentRootCommentResponseDto"];
export type MomentFeed = "DISCOVER" | "FOLLOWING";
export type CreateMomentInput = components["schemas"]["CreateMomentDto"];
export type UpdateMomentInput = components["schemas"]["UpdateMomentDto"];
export type CreateMomentCommentInput = components["schemas"]["CreateMomentCommentDto"];

type MomentListResponse = operations["momentsList"]["responses"][200]["content"]["application/json"];
type MomentCommentListResponse = operations["momentsCommentsList"]["responses"][200]["content"]["application/json"];
type MomentReplyListResponse = operations["momentsReplies"]["responses"][200]["content"]["application/json"];
type MomentCommentAuthorListResponse = operations["momentsCommentAuthors"]["responses"][200]["content"]["application/json"];
type UserMomentListResponse = operations["userMomentsList"]["responses"][200]["content"]["application/json"];
type MomentBookmarkListResponse = operations["momentsBookmarks"]["responses"][200]["content"]["application/json"];

const emptyPage = <T,>() => ({
  code: 0 as const,
  message: "ok",
  data: [] as T[],
  meta: { cursor: null, hasMore: false },
});

export function useMoments(feed: MomentFeed, userId?: string) {
  const viewerScope = userId ?? "anonymous";
  return useInfiniteQuery({
    queryKey: queryKeys.moments.list(feed, viewerScope),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const { data, error } = await apiClient.GET("/api/v1/moments", {
        params: { query: { feed, limit: 20, ...(pageParam ? { cursor: pageParam } : {}) } },
      });
      if (error) throw error;
      return data ?? (emptyPage<MomentCard>() satisfies MomentListResponse);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.meta.hasMore ? page.meta.cursor ?? undefined : undefined,
    enabled: feed === "DISCOVER" || !!userId,
    staleTime: 30_000,
    gcTime: BROWSING_RETURN_GC_TIME,
  });
}

export function useMoment(id: string | undefined, userId?: string) {
  return useQuery({
    queryKey: queryKeys.moments.detail(id, userId ?? "anonymous"),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/moments/{id}", {
        params: { path: { id: id! } },
      });
      if (error) throw error;
      if (!data) throw new Error("动态详情为空");
      return data.data;
    },
    enabled: !!id,
    staleTime: 20_000,
  });
}

export function useCreateMoment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateMomentInput) => {
      const { data, error } = await apiClient.POST("/api/v1/moments", { body });
      if (error) throw error;
      if (!data) throw new Error("发布动态失败");
      return data.data;
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.moments.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    ]),
  });
}

export function useUpdateMoment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateMomentInput }) => {
      const { data, error } = await apiClient.PATCH("/api/v1/moments/{id}", {
        params: { path: { id } },
        body,
      });
      if (error) throw error;
      if (!data) throw new Error("编辑动态失败");
      return data.data;
    },
    onSuccess: (updated) => {
      patchMomentCaches(queryClient, updated.id, () => ({
        title: updated.title,
        contentExcerpt: updated.contentExcerpt,
      }));
      queryClient.setQueriesData(
        {
          predicate: ({ queryKey }) =>
            queryKey[0] === "moments" &&
            queryKey[1] === "detail" &&
            queryKey[2] === updated.id,
        },
        updated,
      );
    },
  });
}

export function useDeleteMoment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/moments/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
      return data?.data;
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.moments.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    ]),
  });
}

export function useMomentLike(id: string, active: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = active
        ? await apiClient.DELETE("/api/v1/moments/{id}/like", { params: { path: { id } } })
        : await apiClient.POST("/api/v1/moments/{id}/like", { params: { path: { id } } });
      if (response.error) throw response.error;
      return response.data?.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ predicate: isMomentCacheQuery });
      const optimisticActive = !active;
      patchMomentCaches(queryClient, id, (moment) => ({
        likeCount: Math.max(0, moment.likeCount + (optimisticActive ? 1 : -1)),
        viewerLiked: optimisticActive,
      }));
      return { optimisticActive };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      patchMomentCaches(queryClient, id, (moment) => {
        if (moment.viewerLiked !== context.optimisticActive) return {};
        return {
          likeCount: Math.max(0, moment.likeCount + (active ? 1 : -1)),
          viewerLiked: active,
        };
      });
    },
    onSuccess: (result) => {
      if (!result) return;
      patchMomentCaches(queryClient, id, () => ({
        likeCount: result.count,
        viewerLiked: result.active,
      }));
    },
  });
}

export function useMomentBookmark(id: string, active: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = active
        ? await apiClient.DELETE("/api/v1/moments/{id}/bookmark", { params: { path: { id } } })
        : await apiClient.POST("/api/v1/moments/{id}/bookmark", { params: { path: { id } } });
      if (response.error) throw response.error;
      return response.data?.data;
    },
    onSuccess: (result) => {
      if (!result) return;
      patchMomentCaches(queryClient, id, () => ({
        bookmarkCount: result.count,
        viewerBookmarked: result.active,
      }));
    },
  });
}

const defaultCommentFilters: ReplyFilters = { order: "NEWEST" };
const defaultNestedReplyFilters: ReplyFilters = { order: "OLDEST" };

export function useMomentComments(
  momentId: string | undefined,
  userId?: string,
  filters: ReplyFilters = defaultCommentFilters,
) {
  const scope = userId ?? "anonymous";
  return useInfiniteQuery({
    queryKey: queryKeys.moments.comments(momentId, scope, filters),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const { data, error } = await apiClient.GET("/api/v1/moments/{id}/comments", {
        params: {
          path: { id: momentId! },
          query: {
            limit: 20,
            order: filters.order,
            ...(filters.authorId ? { authorId: filters.authorId } : {}),
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        },
      });
      if (error) throw error;
      return data ?? (emptyPage<MomentRootComment>() satisfies MomentCommentListResponse);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.meta.hasMore ? page.meta.cursor ?? undefined : undefined,
    enabled: !!momentId,
  });
}

export function useMomentReplies(
  momentId: string,
  commentId: string,
  userId: string | undefined,
  enabled: boolean,
  filters: ReplyFilters = defaultNestedReplyFilters,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.moments.replies(momentId, commentId, userId ?? "anonymous", filters),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const { data, error } = await apiClient.GET("/api/v1/moments/{id}/comments/{commentId}/replies", {
        params: {
          path: { id: momentId, commentId },
          query: {
            limit: 20,
            order: filters.order,
            ...(filters.authorId ? { authorId: filters.authorId } : {}),
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        },
      });
      if (error) throw error;
      return data ?? (emptyPage<MomentComment>() satisfies MomentReplyListResponse);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.meta.hasMore ? page.meta.cursor ?? undefined : undefined,
    enabled,
  });
}

export function useMomentCommentAuthors(momentId: string | undefined, userId?: string) {
  const scope = userId ?? "anonymous";
  return useQuery({
    queryKey: queryKeys.moments.commentAuthors(momentId, scope),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/moments/{id}/comment-authors", {
        params: { path: { id: momentId! } },
      });
      if (error) throw error;
      return (data ?? { code: 0, message: "ok", data: [] }).data satisfies MomentCommentAuthorListResponse["data"];
    },
    enabled: !!momentId,
    staleTime: 20_000,
  });
}

export function useCreateMomentComment(momentId: string, userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateMomentCommentInput) => {
      const { data, error } = await apiClient.POST("/api/v1/moments/{id}/comments", {
        params: { path: { id: momentId } },
        body,
      });
      if (error) throw error;
      if (!data) throw new Error("评论失败");
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.moments.comments(momentId, userId ?? "anonymous") });
      patchMomentCaches(queryClient, momentId, (moment) => ({
        commentCount: moment.commentCount + 1,
      }));
    },
  });
}

export function useDeleteMomentComment(momentId: string, userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { data, error } = await apiClient.DELETE("/api/v1/moments/{id}/comments/{commentId}", {
        params: { path: { id: momentId, commentId } },
      });
      if (error) throw error;
      return data?.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.moments.comments(momentId, userId ?? "anonymous") });
      patchMomentCaches(queryClient, momentId, (moment) => ({
        commentCount: Math.max(0, moment.commentCount - 1),
      }));
    },
  });
}

function useMomentCardPages<TResponse extends { data: MomentCard[]; meta: { cursor: string | null; hasMore: boolean } }>(
  queryKey: readonly unknown[],
  enabled: boolean,
  request: (cursor?: string) => Promise<TResponse>,
) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => request(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.meta.hasMore ? page.meta.cursor ?? undefined : undefined,
    enabled,
  });
}

export function useUserMoments(
  userId: string | undefined,
  viewerId?: string,
  pageSize = 20,
) {
  return useMomentCardPages<UserMomentListResponse>(
    queryKeys.moments.user(userId, viewerId ?? "anonymous", pageSize),
    !!userId,
    async (cursor) => {
      const { data, error } = await apiClient.GET("/api/v1/users/{id}/moments", {
        params: {
          path: { id: userId! },
          query: { limit: pageSize, ...(cursor ? { cursor } : {}) },
        },
      });
      if (error) throw error;
      return data ?? (emptyPage<MomentCard>() satisfies UserMomentListResponse);
    },
  );
}

export function useMomentBookmarks(userId?: string) {
  return useMomentCardPages<MomentBookmarkListResponse>(
    queryKeys.moments.bookmarks(userId ?? "anonymous"),
    !!userId,
    async (cursor) => {
      const { data, error } = await apiClient.GET("/api/v1/moments/bookmarks", {
        params: { query: { limit: 20, ...(cursor ? { cursor } : {}) } },
      });
      if (error) throw error;
      return data ?? (emptyPage<MomentCard>() satisfies MomentBookmarkListResponse);
    },
  );
}
