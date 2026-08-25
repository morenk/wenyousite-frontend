import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  clearMomentCommentCaches,
  clearMomentContentCaches,
  clearPostContentCaches,
  clearThreadContentCaches,
  type ClearCacheOptions,
} from "@/api/content-access-cache";

/** UI 只表达哪个访问边界失效，查询键与清理范围由 API 层统一编排。 */
export function useContentAccessCache() {
  const queryClient = useQueryClient();
  return {
    clearThread: useCallback(
      (threadId: string, options?: ClearCacheOptions) =>
        clearThreadContentCaches(queryClient, threadId, options),
      [queryClient],
    ),
    clearPost: useCallback(
      (postId: string, options?: ClearCacheOptions) =>
        clearPostContentCaches(queryClient, postId, options),
      [queryClient],
    ),
    clearMoment: useCallback(
      (momentId: string, options?: ClearCacheOptions) =>
        clearMomentContentCaches(queryClient, momentId, options),
      [queryClient],
    ),
    clearMomentComments: useCallback(
      (momentId: string, options?: ClearCacheOptions) =>
        clearMomentCommentCaches(queryClient, momentId, options),
      [queryClient],
    ),
  };
}
