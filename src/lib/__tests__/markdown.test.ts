/** sanitizeEmptyImages 工具函数测试 */

import { describe, test, expect } from "vitest";
import { sanitizeEmptyImages } from "@/lib/markdown";

describe("sanitizeEmptyImages", () => {
  test("移除空 URL 图片语法", () => {
    expect(sanitizeEmptyImages("![1.00]()")).toBe("");
    expect(sanitizeEmptyImages("![alt]()")).toBe("");
  });

  test("移除带空格的空 URL 图片语法", () => {
    expect(sanitizeEmptyImages("![1.00]( )")).toBe("");
  });

  test("保留正常图片语法", () => {
    expect(sanitizeEmptyImages("![图](https://example.com/a.jpg)")).toBe(
      "![图](https://example.com/a.jpg)",
    );
  });

  test("混合内容只移除空图片", () => {
    expect(
      sanitizeEmptyImages("前面文字 ![1.00]() 后面文字 ![图](https://a.b/c.png)"),
    ).toBe("前面文字  后面文字 ![图](https://a.b/c.png)");
  });

  test("不误伤空链接语法", () => {
    expect(sanitizeEmptyImages("[链接]()")).toBe("[链接]()");
  });

  test("空字符串原样返回", () => {
    expect(sanitizeEmptyImages("")).toBe("");
  });

  test("整段空图片所在段落被清理为空行", () => {
    expect(sanitizeEmptyImages("\n\n![1.00]()\n\n正文")).toBe("\n\n\n\n正文");
  });
});
