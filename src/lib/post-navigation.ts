/** 站内帖子定位目标；parentPostId 存在时表示楼中楼回复。 */
interface PostNavigationTarget {
  threadId: string;
  postId: string;
  parentPostId?: string | null;
}

const encodeRouteValue = (value: string) => encodeURIComponent(value);

/** 构造主题详情地址；默认子贴不携带冗余查询参数。 */
export function getSubthreadHref(
  threadId: string,
  subthreadId?: string | null,
  defaultSubthreadId?: string | null,
) {
  const base = `/threads/${encodeRouteValue(threadId)}`;
  return !subthreadId || subthreadId === defaultSubthreadId
    ? base
    : `${base}?subthread=${encodeRouteValue(subthreadId)}`;
}

/** 构造某个主楼层的楼中楼讨论页地址。 */
export function getPostDiscussionHref(threadId: string, floorPostId: string) {
  return `/threads/${encodeRouteValue(threadId)}/posts/${encodeRouteValue(floorPostId)}/replies`;
}

/**
 * 构造可精确定位的站内帖子地址。
 * 已知父楼层时直达楼中楼讨论页；未知父楼层时先进入主题详情，由详情页查询后兼容重定向。
 */
export function getPostHref({
  threadId,
  postId,
  parentPostId,
}: PostNavigationTarget) {
  const query = `?post=${encodeRouteValue(postId)}`;
  if (parentPostId) {
    return `${getPostDiscussionHref(threadId, parentPostId)}${query}`;
  }
  return `/threads/${encodeRouteValue(threadId)}${query}`;
}
