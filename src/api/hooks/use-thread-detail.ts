/** 获取主题帖详情 API hook */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";
import { useViewerScope } from "@/api/use-viewer-scope";
import { shouldRetryContentQuery } from "@/api/errors";

export const THREAD_DETAIL_STALE_TIME = 30 * 1000;

export type ThreadTag = components["schemas"]["ThreadTagResponseDto"];
export type ThreadOwner = components["schemas"]["PostAuthorResponseDto"];
export type CurrentThreadMembership =
  components["schemas"]["CurrentThreadMembershipResponseDto"];
export type SubthreadDetail =
  components["schemas"]["ThreadSubthreadResponseDto"];
export type RawThreadDetail =
  components["schemas"]["ThreadDetailResponseDto"];
export type ThreadDetail = Omit<
  RawThreadDetail,
  | "title"
  | "defaultSubthreadId"
  | "isBookmarked"
  | "bookmarkId"
  | "isLiked"
> & {
  title: string;
  defaultSubthreadId: string;
  defaultSubthread: SubthreadDetail;
  isBookmarked: boolean;
  bookmarkId: string | null;
  isLiked: boolean;
};

export function normalizeThreadDetail(raw: RawThreadDetail): ThreadDetail {
  if (!raw.title?.trim()) {
    throw new Error("主题帖详情缺少标题");
  }
  if (!raw.defaultSubthreadId) {
    throw new Error("主题帖详情缺少默认子贴");
  }
  const defaultSubthread = raw.subthreads.find(
    (subthread) => subthread.id === raw.defaultSubthreadId,
  );
  if (!defaultSubthread) {
    throw new Error("主题帖详情未返回可用子贴");
  }

  return {
    ...raw,
    title: raw.title,
    defaultSubthreadId: raw.defaultSubthreadId,
    defaultSubthread,
    isBookmarked: raw.isBookmarked ?? false,
    bookmarkId: raw.bookmarkId ?? null,
    isLiked: raw.isLiked ?? false,
  };
}

export function threadDetailQueryOptions(threadId: string, viewerScope = "anonymous") {
  return {
    queryKey: queryKeys.threads.detailForViewer(threadId, viewerScope),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/threads/{id}", {
        params: { path: { id: threadId } },
      });
      if (error) throw error;
      if (!data) throw new Error("主题帖详情响应为空");
      return normalizeThreadDetail(data.data);
    },
    staleTime: THREAD_DETAIL_STALE_TIME,
    refetchOnMount: "always" as const,
    retry: shouldRetryContentQuery,
  };
}

export function useThreadDetail(threadId: string | undefined) {
  const viewerScope = useViewerScope();
  return useQuery({
    ...threadDetailQueryOptions(threadId ?? "", viewerScope),
    enabled: !!threadId,
  });
}
