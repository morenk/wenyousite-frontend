/** thread-create Zod 校验 schema + validatePublishable 测试 */

import { describe, test, expect } from "vitest";
import { threadCreateSchema, validatePublishable } from "@/lib/validations/thread-create";
import type { ThreadCreateFormData } from "@/lib/validations/thread-create";

const validData: ThreadCreateFormData = {
  title: "测试帖子",
  category: "RPG",
  visibility: "PUBLIC",
  tagNames: ["测试", "RPG"],
  subthreadTitle: "主帖",
  content: "这是正文内容",
};

describe("threadCreateSchema", () => {
  test("完整合法输入通过", () => {
    expect(threadCreateSchema.safeParse(validData).success).toBe(true);
  });

  test("title 不填也可以通过", () => {
    const data = { ...validData, title: undefined };
    expect(threadCreateSchema.safeParse(data).success).toBe(true);
  });

  test("title 超过 100 字符", () => {
    const data = { ...validData, title: "A".repeat(101) };
    const result = threadCreateSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/最多 100/);
    }
  });

  test("title 刚好 100 字符通过", () => {
    expect(
      threadCreateSchema.safeParse({ ...validData, title: "A".repeat(100) })
        .success,
    ).toBe(true);
  });

  test("category 非法值", () => {
    const result = threadCreateSchema.safeParse({
      ...validData,
      category: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  test("visibility 非法值", () => {
    const result = threadCreateSchema.safeParse({
      ...validData,
      visibility: "SECRET",
    });
    expect(result.success).toBe(false);
  });

  test("tagNames 超过 5 个", () => {
    const result = threadCreateSchema.safeParse({
      ...validData,
      tagNames: ["a", "b", "c", "d", "e", "f"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/最多 5 个标签/);
    }
  });

  test("单个标签名超过 20 字符", () => {
    const result = threadCreateSchema.safeParse({
      ...validData,
      tagNames: ["A".repeat(21)],
    });
    expect(result.success).toBe(false);
  });

  test("content 超过 10000 字符", () => {
    const result = threadCreateSchema.safeParse({
      ...validData,
      content: "A".repeat(10001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/最多 10000/);
    }
  });

  test("tagNames 不填也通过", () => {
    const data = { ...validData, tagNames: undefined };
    expect(threadCreateSchema.safeParse(data).success).toBe(true);
  });
});

describe("validatePublishable", () => {
  test("完整合法数据通过", () => {
    expect(validatePublishable(validData)).toBeNull();
  });

  test("title 为空", () => {
    expect(validatePublishable({ ...validData, title: "" })).toMatch(/标题/);
  });

  test("title 为'未命名草稿'", () => {
    expect(
      validatePublishable({ ...validData, title: "未命名草稿" }),
    ).toMatch(/标题/);
  });

  test("content 为空", () => {
    expect(
      validatePublishable({ ...validData, content: "" }),
    ).toMatch(/正文/);
  });

  test("content 只有空格", () => {
    expect(
      validatePublishable({ ...validData, content: "   " }),
    ).toMatch(/正文/);
  });

  test("category 未设置时仍在 schema 层拒绝", () => {
    const data = { ...validData, category: "INVALID" as never };
    const result = threadCreateSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
