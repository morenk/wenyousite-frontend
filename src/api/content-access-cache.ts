import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { queryKeys } from "@/api/query-keys";

export interface ClearCacheOptions {
  /** 页面仍靠活动查询的 error 渲染不可访问态时，先只清理其他缓存。 */
  preserveActive?: boolean;
}

function queryType({ preserveActive = false }: ClearCacheOptions) {
  return preserveActive ? "inactive" as const : "all" as const;
}

function isThreadScopedKey(queryKey: QueryKey, threadId: string): boolean {
  return (
    (queryKey[0] === "thread" && queryKey[1] === threadId) ||
    (queryKey[0] === "members" && queryKey[1] === threadId) ||
    (queryKey[0] === "mention-candidates" && queryKey[1] === threadId) ||
    (queryKey[0] === "thread-search" && queryKey[1] === threadId)
  );
}

/** 权限或存在性失效后清除可能继续展示正文、成员或编辑目标的主题缓存。 */
export function clearThreadContentCaches(
  queryClient: QueryClient,
  threadId: string,
  options: ClearCacheOptions = {},
): void {
  const type = queryType(options);
  queryClient.removeQueries({
    predicate: ({ queryKey }) => isThreadScopedKey(queryKey, threadId),
    type,
  });
  queryClient.removeQueries({ queryKey: queryKeys.floors.all, type });
  queryClient.removeQueries({ queryKey: queryKeys.replies.all, type });
  queryClient.removeQueries({ queryKey: queryKeys.posts.all, type });
}

/** 单个帖子失效时清除详情及可能内嵌该帖的楼层/回复分页。 */
export function clearPostContentCaches(
  queryClient: QueryClient,
  postId: string,
  options: ClearCacheOptions = {},
): void {
  const type = queryType(options);
  queryClient.removeQueries({ queryKey: queryKeys.posts.detail(postId), type });
  queryClient.removeQueries({ queryKey: queryKeys.floors.all, type });
  queryClient.removeQueries({ queryKey: queryKeys.replies.all, type });
}

function isMomentCommentKey(queryKey: QueryKey, momentId: string): boolean {
  return queryKey[0] === "moments" &&
    ["comments", "comment-context", "comment-authors"].includes(String(queryKey[1])) &&
    queryKey[2] === momentId;
}

export function clearMomentCommentCaches(
  queryClient: QueryClient,
  momentId: string,
  options: ClearCacheOptions = {},
): void {
  queryClient.removeQueries({
    predicate: ({ queryKey }) => isMomentCommentKey(queryKey, momentId),
    type: queryType(options),
  });
}

/** 动态失效后清除详情、评论、评论上下文和作者候选。 */
export function clearMomentContentCaches(
  queryClient: QueryClient,
  momentId: string,
  options: ClearCacheOptions = {},
): void {
  queryClient.removeQueries({
    queryKey: queryKeys.moments.detailRoot(momentId),
    type: queryType(options),
  });
  clearMomentCommentCaches(queryClient, momentId, options);
}
