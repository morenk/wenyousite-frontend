/** thread-create Zod 校验 schema — 扩展边界测试 */

import { describe, test, expect } from "vitest";
import { threadCreateSchema, validatePublishable } from "@/lib/validations/thread-create";
import type { ThreadCreateFormData } from "@/lib/validations/thread-create";

const base: ThreadCreateFormData = {
  title: "测试帖",
  category: "DEDUCTION",
  visibility: "PUBLIC",
  tagNames: [],
  subthreadTitle: "主帖",
  content: "正文内容",
};

describe("threadCreateSchema 边界", () => {
  test("title 含特殊字符（然而是合法的）", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      title: "测试 !@#$%^&*() 标题",
    });
    expect(result.success).toBe(true);
  });

  test("title 含 emoji", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      title: "🌟✨🎉 测试帖",
    });
    expect(result.success).toBe(true);
  });

  test("title 只有空格（trim 后为空但仍作为合法字符串通过 Zod 默认）", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      title: "   ",
    });
    expect(result.success).toBe(true);
  });

  test("content 刚好 10000 字符通过", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      content: "A".repeat(10000),
    });
    expect(result.success).toBe(true);
  });

  test("content 9999 字符通过", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      content: "A".repeat(9999),
    });
    expect(result.success).toBe(true);
  });

  test("tagNames 空数组通过", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      tagNames: [],
    });
    expect(result.success).toBe(true);
  });

  test("tagNames 刚好 5 个通过", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      tagNames: ["a", "b", "c", "d", "e"],
    });
    expect(result.success).toBe(true);
  });

  test("单个标签名刚好 20 字符通过", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      tagNames: ["A".repeat(20)],
    });
    expect(result.success).toBe(true);
  });

  test("单个标签名为空字符串", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      tagNames: [""],
    });
    expect(result.success).toBe(false);
  });

  test("subthreadTitle 刚好 100 字符通过", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      subthreadTitle: "A".repeat(100),
    });
    expect(result.success).toBe(true);
  });

  test("subthreadTitle 刚好 1 字符通过", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      subthreadTitle: "A",
    });
    expect(result.success).toBe(true);
  });

  test("subthreadTitle 为空字符串", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      subthreadTitle: "",
    });
    expect(result.success).toBe(false);
  });

  test("content 为空字符串通过", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      content: "",
    });
    expect(result.success).toBe(true);
  });

  test("content 不传通过", () => {
    const withoutContent: Omit<ThreadCreateFormData, "content"> = {
      title: base.title,
      category: base.category,
      visibility: base.visibility,
      tagNames: base.tagNames,
      subthreadTitle: base.subthreadTitle,
    };
    const result = threadCreateSchema.safeParse(withoutContent);
    expect(result.success).toBe(true);
  });

  test("category 为 DEDUCTION 通过", () => {
    expect(
      threadCreateSchema.safeParse({ ...base, category: "DEDUCTION" }).success,
    ).toBe(true);
  });

  test("category 为 NATION 通过", () => {
    expect(
      threadCreateSchema.safeParse({ ...base, category: "NATION" }).success,
    ).toBe(true);
  });

  test("visibility 为 PRIVATE 通过", () => {
    expect(
      threadCreateSchema.safeParse({ ...base, visibility: "PRIVATE" }).success,
    ).toBe(true);
  });

  test("tagNames 全部 20 字符刚好通过", () => {
    const result = threadCreateSchema.safeParse({
      ...base,
      tagNames: ["A".repeat(20), "B".repeat(20), "C".repeat(20), "D".repeat(20), "E".repeat(20)],
    });
    expect(result.success).toBe(true);
  });
});

describe("validatePublishable 边界", () => {
  test("title 只有空格", () => {
    expect(validatePublishable({ ...base, title: "  " })).toMatch(/标题/);
  });

  test("标题为纯英文通过", () => {
    expect(validatePublishable({ ...base, title: "Hello World" })).toBeNull();
  });

  test("标题为纯中文通过", () => {
    expect(
      validatePublishable({ ...base, title: "你好世界" }),
    ).toBeNull();
  });

  test("正文只有换行符", () => {
    expect(
      validatePublishable({ ...base, content: "\n\n" }),
    ).toMatch(/正文/);
  });

  test("所有字段有效时通过", () => {
    expect(validatePublishable(base)).toBeNull();
  });
});
