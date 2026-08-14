import { describe, expect, test } from "vitest";
import { parseAdminContentReference } from "@/lib/admin-content-reference";

describe("parseAdminContentReference", () => {
  test("裸编号沿用当前选择的目标类型", () => {
    expect(parseAdminContentReference("  post-1  ", "post")).toEqual({
      type: "post",
      id: "post-1",
    });
  });

  test("从主题帖与楼层链接识别实际处置目标", () => {
    expect(parseAdminContentReference("https://wenyou.site/threads/thread-1", "post")).toEqual({
      type: "thread",
      id: "thread-1",
    });
    expect(parseAdminContentReference("/threads/thread-1?post=floor-2", "thread")).toEqual({
      type: "post",
      id: "floor-2",
    });
    expect(
      parseAdminContentReference(
        "/threads/thread-1/posts/floor-2/replies?post=reply-3",
        "thread",
      ),
    ).toEqual({ type: "post", id: "reply-3" });
  });

  test("从动态链接优先识别精确评论或回复", () => {
    expect(parseAdminContentReference("/moments/moment-1", "thread")).toEqual({
      type: "moment",
      id: "moment-1",
    });
    expect(
      parseAdminContentReference(
        "/moments/moment-1?comment=comment-1&reply=reply-1#moment-comment-reply-1",
        "moment",
      ),
    ).toEqual({ type: "moment_comment", id: "reply-1" });
  });

  test("空值与非站内内容链接不会生成目标", () => {
    expect(parseAdminContentReference("", "moment")).toBeNull();
    expect(parseAdminContentReference("https://example.com/not-content", "moment")).toBeNull();
  });
});
