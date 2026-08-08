import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import { isMomentCacheQuery, patchMomentCaches } from "@/api/moment-cache";
import { queryKeys } from "@/api/query-keys";

const moment = {
  id: "moment-1",
  coverType: "TEXT" as const,
  title: "动态",
  contentExcerpt: "正文",
  likeCount: 1,
  commentCount: 2,
  bookmarkCount: 3,
  tipTotal: "4",
  viewerLiked: false,
  viewerBookmarked: false,
};

describe("patchMomentCaches", () => {
  test("同时修补详情、分页和动态搜索缓存且保持列表顺序", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.moments.detail("moment-1", "user-1"), moment);
    client.setQueryData(queryKeys.moments.list("DISCOVER", "user-1"), {
      pages: [{ data: [moment, { ...moment, id: "moment-2" }] }],
    });
    client.setQueryData(queryKeys.search.moments("测试", "user-1"), {
      pages: [{ data: [moment] }],
    });

    patchMomentCaches(client, "moment-1", (current) => ({
      likeCount: current.likeCount + 1,
      viewerLiked: true,
    }));

    expect(client.getQueryData(queryKeys.moments.detail("moment-1", "user-1"))).toEqual({
      ...moment,
      likeCount: 2,
      viewerLiked: true,
    });
    const list = client.getQueryData<{ pages: { data: typeof moment[] }[] }>(
      queryKeys.moments.list("DISCOVER", "user-1"),
    );
    expect(list?.pages[0].data.map((item) => item.id)).toEqual(["moment-1", "moment-2"]);
    expect(list?.pages[0].data[0].likeCount).toBe(2);
    const search = client.getQueryData<{ pages: { data: typeof moment[] }[] }>(
      queryKeys.search.moments("测试", "user-1"),
    );
    expect(search?.pages[0].data[0].viewerLiked).toBe(true);
  });

  test("目标不存在时保留原缓存引用", () => {
    const client = new QueryClient();
    const value = { pages: [{ data: [moment] }] };
    client.setQueryData(queryKeys.moments.list("DISCOVER", "user-1"), value);

    patchMomentCaches(client, "missing", () => ({ likeCount: 99 }));

    expect(client.getQueryData(queryKeys.moments.list("DISCOVER", "user-1"))).toBe(value);
  });

  test("缓存修补只命中动态实体，排除评论、回复和作者候选查询", () => {
    expect(isMomentCacheQuery({ queryKey: queryKeys.moments.list("DISCOVER", "user-1") })).toBe(true);
    expect(isMomentCacheQuery({ queryKey: queryKeys.moments.detail("moment-1", "user-1") })).toBe(true);
    expect(isMomentCacheQuery({ queryKey: queryKeys.moments.user("author-1", "user-1") })).toBe(true);
    expect(isMomentCacheQuery({ queryKey: queryKeys.moments.bookmarks("user-1") })).toBe(true);
    expect(isMomentCacheQuery({ queryKey: queryKeys.search.moments("测试", "user-1") })).toBe(true);

    expect(isMomentCacheQuery({
      queryKey: queryKeys.moments.comments("moment-1", "user-1", { order: "NEWEST" }),
    })).toBe(false);
    expect(isMomentCacheQuery({
      queryKey: queryKeys.moments.replies("moment-1", "comment-1", "user-1"),
    })).toBe(false);
    expect(isMomentCacheQuery({
      queryKey: queryKeys.moments.commentAuthors("moment-1", "user-1"),
    })).toBe(false);
  });
});
