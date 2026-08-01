/** profile 校验 schema 测试 */

import { describe, test, expect } from "vitest";
import { profileSchema } from "@/lib/validations/profile";

describe("profileSchema", () => {
  test("合法输入通过", () => {
    const result = profileSchema.safeParse({
      username: "小明",
      bio: "你好",
      showRecentReplies: true,
      showPlayerBadges: true,
      showBookmarks: true,
    });
    expect(result.success).toBe(true);
  });

  test("用户名为空时校验失败", () => {
    const result = profileSchema.safeParse({
      username: "",
      bio: "",
      showRecentReplies: true,
      showPlayerBadges: true,
      showBookmarks: true,
    });
    expect(result.success).toBe(false);
  });

  test("用户名含特殊字符校验失败", () => {
    const result = profileSchema.safeParse({
      username: "bad name!",
      bio: "",
      showRecentReplies: true,
      showPlayerBadges: true,
      showBookmarks: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/字母、数字和中文/);
    }
  });

  test("bio 超长校验失败", () => {
    const result = profileSchema.safeParse({
      username: "小明",
      bio: "x".repeat(256),
      showRecentReplies: true,
      showPlayerBadges: true,
      showBookmarks: true,
    });
    expect(result.success).toBe(false);
  });

  test("bio 可选", () => {
    const result = profileSchema.safeParse({
      username: "小明",
      showRecentReplies: true,
      showPlayerBadges: true,
      showBookmarks: true,
    });
    expect(result.success).toBe(true);
  });
});
