import { describe, expect, test } from "vitest";
import { parseRpProfilePostLink } from "../rp-profile-post-link";

const thread = "c00000000000000000000000t";
const post = "c00000000000000000000000p";
const parent = "c00000000000000000000000a";
const base = "/threads/" + thread;
describe("资料楼层链接", () => {
  test.each([base + "?post=" + post, "https://wenyou.site" + base + "?post=" + post,
    base + "?post=" + post + "&order=NEWEST", base + "?subthread=" + parent + "&post=" + post])("解析复制的正文或楼层链接 %s", (href) => {
    expect(parseRpProfilePostLink(href, thread)).toEqual({ threadId: thread, postId: post });
  });
  test("保留楼中楼父坐标用于详情核对；同源隔离链接可显式传入", () => {
    expect(parseRpProfilePostLink("http://127.0.0.1:4000" + base + "/posts/" + parent + "/replies?post=" + post, thread, "http://127.0.0.1:4000"))
      .toEqual({ threadId: thread, postId: post, parentPostId: parent });
  });
  test.each([
    "", base, base + "?post=" + post + "&post=" + parent, base + "?post=" + post + "&order=invalid",
    base + "?post=" + post + "#fragment", "https://evil.example" + base + "?post=" + post,
    "https://wenyou.site.evil.example" + base + "?post=" + post, "//wenyou.site" + base + "?post=" + post,
    "https://user@wenyou.site" + base + "?post=" + post, "/threads/" + parent + "?post=" + post,
    base + "?post=" + post + "&redirect=https://evil.example", base + "?post=invalid",
  ])("拒绝无目标、外域或冲突链接 %s", (href) => { expect(parseRpProfilePostLink(href, thread)).toBeNull(); });
});
