import { queryKeys } from "@/api/query-keys";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import {
  clearMomentContentCaches,
  clearMomentCommentCaches,
  clearPostContentCaches,
  clearThreadContentCaches,
  resetBlockRelatedQueries,
} from "@/api/content-access-cache";

describe("失效内容缓存清理", () => {
  test("主题不可访问时移除主题正文与全部帖子衍生缓存", () => {
    const client = new QueryClient();
    client.setQueryData(["thread", "t1", "viewer", "u1"], { secret: true });
    client.setQueryData(["thread", "t2", "viewer", "u1"], { keep: true });
    client.setQueryData(["members", "t1"], [{ id: "u1" }]);
    client.setQueryData(["floors", "s1"], [{ id: "p1" }]);
    client.setQueryData(["replies", "p1"], [{ id: "r1" }]);
    client.setQueryData(["post", "p1", "viewer", "u1"], { id: "p1" });

    clearThreadContentCaches(client, "t1");

    expect(client.getQueryData(["thread", "t1", "viewer", "u1"])).toBeUndefined();
    expect(client.getQueryData(["members", "t1"])).toBeUndefined();
    expect(client.getQueryData(["floors", "s1"])).toBeUndefined();
    expect(client.getQueryData(["replies", "p1"])).toBeUndefined();
    expect(client.getQueryData(["post", "p1", "viewer", "u1"])).toBeUndefined();
    expect(client.getQueryData(["thread", "t2", "viewer", "u1"])).toEqual({ keep: true });
  });

  test("帖子失效时移除帖子详情和可能包含它的分页", () => {
    const client = new QueryClient();
    client.setQueryData(["post", "p1", "viewer", "u1"], { id: "p1" });
    client.setQueryData(["post", "p2", "viewer", "u1"], { id: "p2" });
    client.setQueryData(["floors", "s1"], [{ id: "p1" }]);

    clearPostContentCaches(client, "p1");

    expect(client.getQueryData(["post", "p1", "viewer", "u1"])).toBeUndefined();
    expect(client.getQueryData(["floors", "s1"])).toBeUndefined();
    expect(client.getQueryData(["post", "p2", "viewer", "u1"])).toEqual({ id: "p2" });
  });

  test("动态失效时只移除该动态的详情和评论树", () => {
    const client = new QueryClient();
    client.setQueryData(["moments", "detail", "m1", "u1"], { id: "m1" });
    client.setQueryData(["moments", "comments", "m1", "u1"], [{ id: "c1" }]);
    client.setQueryData(["moments", "comment-context", "m1", "u1", "c1"], { id: "c1" });
    client.setQueryData(["moments", "detail", "m2", "u1"], { id: "m2" });

    clearMomentContentCaches(client, "m1");

    expect(client.getQueryData(["moments", "detail", "m1", "u1"])).toBeUndefined();
    expect(client.getQueryData(["moments", "comments", "m1", "u1"])).toBeUndefined();
    expect(client.getQueryData(["moments", "comment-context", "m1", "u1", "c1"])).toBeUndefined();
    expect(client.getQueryData(["moments", "detail", "m2", "u1"])).toEqual({ id: "m2" });
  });

  test("评论目标失效时保留仍可阅读的动态详情", () => {
    const client = new QueryClient();
    client.setQueryData(["moments", "detail", "m1", "u1"], { id: "m1" });
    client.setQueryData(["moments", "comments", "m1", "u1"], [{ id: "c1" }]);

    clearMomentCommentCaches(client, "m1");

    expect(client.getQueryData(["moments", "detail", "m1", "u1"])).toEqual({ id: "m1" });
    expect(client.getQueryData(["moments", "comments", "m1", "u1"])).toBeUndefined();
  });
});

test("主题不可访问删除本人token与身份卡缓存，保留其他主题；拉黑取消并重置全部身份", async () => {
  const client = new QueryClient();
  const mine = queryKeys.threadIdentities.mine("t1", "u1");
  const card = queryKeys.threadIdentities.user("t1", "u2", "u1");
  const other = queryKeys.threadIdentities.mine("t2", "u1");
  const roles = queryKeys.threadIdentities.collection("t1", "u1");
  const role = queryKeys.threadIdentities.role("t1", "role-b", "u1");
  for (const key of [mine, card, roles, role, other]) client.setQueryData(key, { private: true });
  clearThreadContentCaches(client, "t1");
  expect(client.getQueryData(mine)).toBeUndefined();
  expect(client.getQueryData(card)).toBeUndefined();
  expect(client.getQueryData(roles)).toBeUndefined();
  expect(client.getQueryData(role)).toBeUndefined();
  expect(client.getQueryData(other)).toEqual({ private: true });
  const cancel = vi.spyOn(client, "cancelQueries");
  const reset = vi.spyOn(client, "resetQueries");
  await resetBlockRelatedQueries(client);
  expect(cancel).toHaveBeenCalledWith({ queryKey: queryKeys.threadIdentities.all });
  expect(reset).toHaveBeenCalledWith({ queryKey: queryKeys.threadIdentities.all });
  expect(client.getQueryData(other)).toBeUndefined();
});
