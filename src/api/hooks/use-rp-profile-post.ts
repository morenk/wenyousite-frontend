import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { getApiError, isContentUnavailableError, shouldRetryContentQuery } from "@/api/errors";
import { queryKeys } from "@/api/query-keys";
import { useViewerScope } from "@/api/use-viewer-scope";
import { parseRpProfilePostLink } from "@/lib/rp-profile-post-link";
import type { PostDetail } from "./use-post";

export function isProfilePostUnavailable(error: unknown) {
  const parsed = getApiError(error);
  return isContentUnavailableError(error) || parsed.status === 403 || parsed.status === 404
    || (parsed.code !== undefined && parsed.code >= 40300 && parsed.code < 40500);
}

async function readProfilePost(postId: string, signal?: AbortSignal): Promise<PostDetail> {
  const { data, error } = await apiClient.GET("/api/v1/posts/{id}", {
    params: { path: { id: postId } }, signal, cache: "no-store",
  });
  if (error) throw error;
  if (!data) throw new Error("资料加载失败，请重试");
  return data.data;
}

/** 卡片只在本次身份重新授权后启用；重开、刷新或换角色时不返回旧正文。 */
export function useRpProfilePost(threadId: string, identityId: string, postId: string | undefined, supported: boolean) {
  const viewer = useViewerScope();
  const query = useQuery({
    queryKey: queryKeys.posts.profile(threadId, identityId, postId, viewer, supported),
    queryFn: async ({ signal }) => {
      const post = await readProfilePost(postId!, signal);
      if (post.threadId !== threadId || post.id !== postId || post.deletedAt) throw { status: 404, code: 40403 };
      return post;
    },
    enabled: Boolean(supported && postId), staleTime: 0, gcTime: 0,
    refetchOnMount: "always", retry: shouldRetryContentQuery,
  });
  return { ...query, data: supported && postId && !query.isFetching && !query.isError ? query.data : undefined };
}

export class RpProfilePostLinkError extends Error {}

/** 从经过白名单校验的坐标读取授权详情；永不访问输入 URL 自身。 */
export function useResolveRpProfilePostLink(threadId: string) {
  return useMutation({
    mutationFn: async (input: string) => {
      const target = parseRpProfilePostLink(input, threadId, typeof window === "undefined" ? undefined : window.location.origin);
      if (!target) throw new RpProfilePostLinkError("请粘贴当前主题的有效楼层链接");
      let post: PostDetail;
      try { post = await readProfilePost(target.postId); }
      catch (error) {
        if (isProfilePostUnavailable(error)) throw new RpProfilePostLinkError("资料暂不可用");
        throw new RpProfilePostLinkError("楼层校验失败，请重试");
      }
      if (post.id !== target.postId || post.threadId !== threadId || post.deletedAt
        || (target.parentPostId && post.parentPostId !== target.parentPostId)) {
        throw new RpProfilePostLinkError("资料暂不可用");
      }
      return post.id;
    },
  });
}
