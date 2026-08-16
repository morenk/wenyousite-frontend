import type { FloorOrder } from "@/api/floor-query";

/** 站内帖子定位目标；parentPostId 存在时表示楼中楼回复。 */
interface PostNavigationTarget {
  threadId: string;
  postId: string;
  parentPostId?: string | null;
  floorOrder?: FloorOrder;
}

const encodeRouteValue = (value: string) => encodeURIComponent(value);

/** 构造主题详情地址；默认子贴不携带冗余查询参数。 */
export function getSubthreadHref(
  threadId: string,
  subthreadId?: string | null,
  defaultSubthreadId?: string | null,
  floorOrder: FloorOrder = "OLDEST",
) {
  const base = `/threads/${encodeRouteValue(threadId)}`;
  const query = new URLSearchParams();
  if (subthreadId && subthreadId !== defaultSubthreadId) {
    query.set("subthread", subthreadId);
  }
  if (floorOrder === "NEWEST") query.set("order", floorOrder);
  const search = query.toString();
  return search ? `${base}?${search}` : base;
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
  floorOrder = "OLDEST",
}: PostNavigationTarget) {
  const query = new URLSearchParams({ post: postId });
  if (!parentPostId && floorOrder === "NEWEST") query.set("order", floorOrder);
  const search = `?${query.toString()}`;
  if (parentPostId) {
    return `${getPostDiscussionHref(threadId, parentPostId)}${search}`;
  }
  return `/threads/${encodeRouteValue(threadId)}${search}`;
}
