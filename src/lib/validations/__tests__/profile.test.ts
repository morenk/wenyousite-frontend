/** profile 校验 schema 测试：主表单（不含用户名）+ 独立用户名 schema */

import { describe, test, expect } from "vitest";
import { profileSchema, usernameSchema } from "@/lib/validations/profile";

describe("profileSchema（主表单，不含 username）", () => {
  test("合法输入通过（bio 可选）", () => {
    const result = profileSchema.safeParse({
      bio: "你好",
      showRecentReplies: true,
      showPlayerBadges: true,
      showBookmarks: true,
    });
    expect(result.success).toBe(true);
  });

  test("不传 username 也不报错", () => {
    const result = profileSchema.safeParse({
      showRecentReplies: true,
      showPlayerBadges: true,
      showBookmarks: true,
    });
    expect(result.success).toBe(true);
  });

  test("bio 超长校验失败", () => {
    const result = profileSchema.safeParse({
      bio: "x".repeat(256),
      showRecentReplies: true,
      showPlayerBadges: true,
      showBookmarks: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("usernameSchema（独立修改）", () => {
  test("合法用户名通过", () => {
    expect(usernameSchema.safeParse({ username: "morenk" }).success).toBe(true);
    expect(usernameSchema.safeParse({ username: "小明123" }).success).toBe(true);
  });

  test("用户名为空校验失败", () => {
    const result = usernameSchema.safeParse({ username: "" });
    expect(result.success).toBe(false);
  });

  test("用户名含特殊字符校验失败", () => {
    const result = usernameSchema.safeParse({ username: "bad name!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/字母、数字和中文/);
    }
  });

  test("用户名超长校验失败", () => {
    const result = usernameSchema.safeParse({ username: "a".repeat(25) });
    expect(result.success).toBe(false);
  });

  test("用户名过短校验失败", () => {
    const result = usernameSchema.safeParse({ username: "a" });
    expect(result.success).toBe(false);
  });
});
