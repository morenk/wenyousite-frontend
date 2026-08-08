import type { QueryClient } from "@tanstack/react-query";

type MomentCacheEntity = {
  id: string;
  coverType: "IMAGE" | "TEXT";
  title: string;
  contentExcerpt: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  tipTotal: string;
  viewerLiked: boolean;
  viewerBookmarked: boolean;
  [key: string]: unknown;
};

type MomentCachePatch = Partial<
  Pick<
    MomentCacheEntity,
    | "likeCount"
    | "commentCount"
    | "bookmarkCount"
    | "tipTotal"
    | "viewerLiked"
    | "viewerBookmarked"
    | "title"
    | "contentExcerpt"
  >
>;

function patchValue(
  value: unknown,
  momentId: string,
  updater: (moment: MomentCacheEntity) => MomentCachePatch,
): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const patched = patchValue(item, momentId, updater);
      if (patched !== item) changed = true;
      return patched;
    });
    return changed ? next : value;
  }
  if (!value || typeof value !== "object") return value;

  const entity = value as Partial<MomentCacheEntity>;
  if (entity.id === momentId && entity.coverType && typeof entity.likeCount === "number") {
    return { ...entity, ...updater(entity as MomentCacheEntity) };
  }

  const record = value as Record<string, unknown>;
  let changed = false;
  const next = { ...record };
  for (const key of ["data", "pages"] as const) {
    if (!(key in record)) continue;
    const patched = patchValue(record[key], momentId, updater);
    if (patched !== record[key]) {
      next[key] = patched;
      changed = true;
    }
  }
  return changed ? next : value;
}

/**
 * 原地修补动态卡片与详情缓存，避免点赞、收藏、评论或加油后重新请求发现流，
 * 从而让用户正在阅读的瀑布流卡片保持原位置。
 */
export function patchMomentCaches(
  queryClient: QueryClient,
  momentId: string,
  updater: (moment: MomentCacheEntity) => MomentCachePatch,
) {
  queryClient.setQueriesData(
    {
      predicate: isMomentCacheQuery,
    },
    (value) => patchValue(value, momentId, updater),
  );
}

export function isMomentCacheQuery({ queryKey }: { queryKey: readonly unknown[] }): boolean {
  if (queryKey[0] === "search") return queryKey[1] === "moments";
  if (queryKey[0] !== "moments") return false;
  return queryKey[1] === "list" ||
    queryKey[1] === "detail" ||
    queryKey[1] === "user" ||
    queryKey[1] === "bookmarks";
}
