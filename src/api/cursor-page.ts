/** 只共享游标响应的结构；请求参数、权限和缓存策略由各业务 hook 保留。 */
export const emptyCursorPage = <T,>() => ({
  code: 0 as const,
  message: "ok",
  data: [] as T[],
  meta: { cursor: null, hasMore: false },
});

export function getNextCursor(page: { meta?: { hasMore?: boolean; cursor?: string | null } } | undefined) {
  return page?.meta?.hasMore ? page.meta.cursor ?? undefined : undefined;
}
