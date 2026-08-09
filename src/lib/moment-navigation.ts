const MOMENT_FEED_RETURN_STORAGE_KEY = "wenyousite:moment-feed-return";
const MOMENT_FEED_RESTORE_STORAGE_KEY = "wenyousite:moment-feed-restore";
const MOMENT_FEED_BROWSE_STORAGE_KEY = "wenyousite:moment-feed-browse";
const MOMENT_FEED_RETURN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type MomentFeedBrowseMode = "DISCOVER" | "FOLLOWING";

interface MomentFeedReturnMarker {
  momentId: string;
  source: "/moments";
  feed: MomentFeedBrowseMode;
  scrollY: number;
  createdAt: number;
}

export interface MomentFeedRestoreState {
  feed: MomentFeedBrowseMode;
  scrollY: number;
}

function isMomentFeed(value: unknown): value is MomentFeedBrowseMode {
  return value === "DISCOVER" || value === "FOLLOWING";
}

/** 记录主动态页当前选中的 Feed，供卡片和全局发布器共享。 */
export function rememberMomentFeed(feed: MomentFeedBrowseMode): void {
  try {
    window.sessionStorage.setItem(MOMENT_FEED_BROWSE_STORAGE_KEY, feed);
  } catch {
    // 存储不可用时默认恢复发现流。
  }
}

/**
 * 只记录从动态主 Feed 发起的同标签页导航。
 * 实际列表数据与滚动位置仍交给 App Router 的浏览历史恢复。
 */
export function markMomentFeedReturn(momentId: string, pathname: string): void {
  if (pathname !== "/moments") return;
  try {
    const storedFeed = window.sessionStorage.getItem(MOMENT_FEED_BROWSE_STORAGE_KEY);
    const marker: MomentFeedReturnMarker = {
      momentId,
      source: "/moments",
      feed: isMomentFeed(storedFeed) ? storedFeed : "DISCOVER",
      scrollY: Math.max(0, window.scrollY),
      createdAt: Date.now(),
    };
    window.sessionStorage.setItem(MOMENT_FEED_RETURN_STORAGE_KEY, JSON.stringify(marker));
  } catch {
    // 隐私模式或禁用存储时安全降级为返回发现流。
  }
}

/**
 * 返回详情时一次性消费标记；仅精确匹配且未过期的当前动态可以使用历史后退。
 */
export function takeMomentFeedReturn(momentId: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(MOMENT_FEED_RETURN_STORAGE_KEY);
    window.sessionStorage.removeItem(MOMENT_FEED_RETURN_STORAGE_KEY);
    if (!raw) return false;
    const marker = JSON.parse(raw) as Partial<MomentFeedReturnMarker>;
    const age = Date.now() - (marker.createdAt ?? Number.NaN);
    const valid = marker.momentId === momentId &&
      marker.source === "/moments" &&
      isMomentFeed(marker.feed) &&
      Number.isFinite(marker.scrollY) &&
      (marker.scrollY ?? -1) >= 0 &&
      Number.isFinite(age) &&
      age >= 0 &&
      age <= MOMENT_FEED_RETURN_MAX_AGE_MS;
    if (!valid) return false;
    window.sessionStorage.setItem(MOMENT_FEED_RESTORE_STORAGE_KEY, JSON.stringify({
      feed: marker.feed,
      scrollY: marker.scrollY,
      createdAt: marker.createdAt,
    }));
    return true;
  } catch {
    return false;
  }
}

/** 动态列表挂载时一次性读取并清除待恢复的 Feed 与滚动位置。 */
export function takeMomentFeedRestore(): MomentFeedRestoreState | null {
  try {
    const raw = window.sessionStorage.getItem(MOMENT_FEED_RESTORE_STORAGE_KEY);
    window.sessionStorage.removeItem(MOMENT_FEED_RESTORE_STORAGE_KEY);
    if (!raw) return null;
    const restore = JSON.parse(raw) as Partial<MomentFeedRestoreState> & { createdAt?: number };
    const age = Date.now() - (restore.createdAt ?? Number.NaN);
    if (
      !isMomentFeed(restore.feed) ||
      !Number.isFinite(restore.scrollY) ||
      (restore.scrollY ?? -1) < 0 ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > MOMENT_FEED_RETURN_MAX_AGE_MS
    ) return null;
    return { feed: restore.feed, scrollY: restore.scrollY! };
  } catch {
    return null;
  }
}

export function clearMomentFeedReturn(): void {
  try {
    window.sessionStorage.removeItem(MOMENT_FEED_RETURN_STORAGE_KEY);
  } catch {
    // 清理失败不影响页面浏览。
  }
}
