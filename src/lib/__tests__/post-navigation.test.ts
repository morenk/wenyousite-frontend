import { describe, expect, test } from "vitest";
import {
  getPostDiscussionHref,
  getPostHref,
} from "@/lib/post-navigation";

describe("post-navigation", () => {
  test("主楼层定位到主题帖详情", () => {
    expect(getPostHref({ threadId: "t1", postId: "p1" })).toBe(
      "/threads/t1?post=p1",
    );
  });

  test("楼中楼回复直接定位到所属讨论页", () => {
    expect(
      getPostHref({ threadId: "t1", postId: "r1", parentPostId: "p1" }),
    ).toBe("/threads/t1/posts/p1/replies?post=r1");
  });

  test("讨论页地址不携带目标回复时仍可复用", () => {
    expect(getPostDiscussionHref("t1", "p1")).toBe(
      "/threads/t1/posts/p1/replies",
    );
  });

  test("路径段与查询参数统一编码", () => {
    expect(
      getPostHref({
        threadId: "thread/with/slash",
        postId: "post?query",
        parentPostId: "parent#hash",
      }),
    ).toBe(
      "/threads/thread%2Fwith%2Fslash/posts/parent%23hash/replies?post=post%3Fquery",
    );
  });
});
