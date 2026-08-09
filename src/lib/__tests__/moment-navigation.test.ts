import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  clearMomentFeedReturn,
  markMomentFeedReturn,
  rememberMomentFeed,
  takeMomentFeedReturn,
  takeMomentFeedRestore,
} from "@/lib/moment-navigation";

describe("moment feed return navigation", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  test("只为动态主 Feed 记录同标签页返回上下文", () => {
    markMomentFeedReturn("moment-search", "/search");
    expect(takeMomentFeedReturn("moment-search")).toBe(false);

    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(640);
    rememberMomentFeed("FOLLOWING");
    markMomentFeedReturn("moment-1", "/moments");
    expect(takeMomentFeedReturn("moment-1")).toBe(true);
    expect(takeMomentFeedRestore()).toEqual({ feed: "FOLLOWING", scrollY: 640 });
    expect(takeMomentFeedRestore()).toBeNull();
    expect(takeMomentFeedReturn("moment-1")).toBe(false);
  });

  test("错误动态、未来时间和两小时前的标记都安全回退", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000_000);
    markMomentFeedReturn("moment-1", "/moments");
    expect(takeMomentFeedReturn("moment-2")).toBe(false);

    now.mockReturnValue(20_000_000);
    markMomentFeedReturn("moment-1", "/moments");
    now.mockReturnValue(19_999_999);
    expect(takeMomentFeedReturn("moment-1")).toBe(false);

    now.mockReturnValue(30_000_000);
    markMomentFeedReturn("moment-1", "/moments");
    now.mockReturnValue(30_000_000 + 2 * 60 * 60 * 1000 + 1);
    expect(takeMomentFeedReturn("moment-1")).toBe(false);
  });

  test("损坏数据与主动清理不会阻断导航", () => {
    window.sessionStorage.setItem("wenyousite:moment-feed-return", "not-json");
    expect(takeMomentFeedReturn("moment-1")).toBe(false);

    markMomentFeedReturn("moment-1", "/moments");
    clearMomentFeedReturn();
    expect(takeMomentFeedReturn("moment-1")).toBe(false);
  });

  test("损坏或过期的列表恢复上下文只消费一次", () => {
    window.sessionStorage.setItem("wenyousite:moment-feed-restore", "not-json");
    expect(takeMomentFeedRestore()).toBeNull();

    const now = vi.spyOn(Date, "now").mockReturnValue(50_000_000);
    rememberMomentFeed("DISCOVER");
    markMomentFeedReturn("moment-1", "/moments");
    expect(takeMomentFeedReturn("moment-1")).toBe(true);
    now.mockReturnValue(50_000_000 + 2 * 60 * 60 * 1000 + 1);
    expect(takeMomentFeedRestore()).toBeNull();
  });
});
