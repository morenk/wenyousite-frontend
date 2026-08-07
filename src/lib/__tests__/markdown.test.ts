/** sanitizeEmptyImages 工具函数测试 */

import { describe, test, expect } from "vitest";
import {
  sanitizeEmptyImages,
  hasVisibleMarkdownContent,
  sanitizeMilkdownMarkdown,
} from "@/lib/markdown";
import markdownV2Fixtures from "../../../contracts/markdown-v2-fixtures.json";

type MarkdownFixture = (typeof markdownV2Fixtures.cases)[number];

describe("Markdown v2 黄金语料", () => {
  test("协议版本正确且 case id 唯一", () => {
    expect(markdownV2Fixtures.contract).toBe("wenyousite-markdown");
    expect(markdownV2Fixtures.version).toBe(2);
    expect(new Set(markdownV2Fixtures.cases.map(({ id }) => id)).size).toBe(
      markdownV2Fixtures.cases.length,
    );
  });

  test.each(markdownV2Fixtures.cases)(
    "$id 规范化为 canonical 且保持幂等",
    ({ input, canonical }: MarkdownFixture) => {
      expect(sanitizeMilkdownMarkdown(input)).toBe(canonical);
      expect(sanitizeMilkdownMarkdown(canonical)).toBe(canonical);
    },
  );

  test.each(markdownV2Fixtures.cases)(
    "$id 的发布可见性符合协议",
    ({ input, canonical, visible }: MarkdownFixture) => {
      expect(hasVisibleMarkdownContent(input)).toBe(visible);
      expect(hasVisibleMarkdownContent(canonical)).toBe(visible);
    },
  );
});

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

describe("sanitizeMilkdownMarkdown", () => {
  test("保留并规范化 Milkdown 顶层空段落标记", () => {
    expect(
      sanitizeMilkdownMarkdown(
        "第一段\n\n<br />\n<br>\n<br >\n<br/>\n\n第二段",
      ),
    ).toBe("第一段\n\n<br />\n<br />\n<br />\n<br />\n\n第二段");
  });

  test("保留正文行内显式输入的 br 文本", () => {
    expect(sanitizeMilkdownMarkdown("正文 <br /> 示例")).toBe(
      "正文 <br /> 示例",
    );
  });

  test("保留围栏代码块中的 br 示例", () => {
    const markdown =
      "```html\n<br />\n![empty]()\n```\n\n~~~html\n<br>\n![empty]( )\n~~~";
    expect(sanitizeMilkdownMarkdown(markdown)).toBe(markdown);
  });

  test("清理空 URL 图片但保留空段落", () => {
    expect(sanitizeMilkdownMarkdown("![1.00]()\n\n<br />\n正文")).toBe(
      "\n\n<br />\n正文",
    );
  });
});

describe("hasVisibleMarkdownContent", () => {
  test("纯空白和独立分隔线不可发布", () => {
    expect(hasVisibleMarkdownContent("\n<br />\n\n---\n")).toBe(false);
  });

  test("图片可单独发布，文字周围可保留空段落", () => {
    expect(hasVisibleMarkdownContent("\n<br />\n![图](https://a.test/x.png)\n")).toBe(true);
  });

  test("代码块内容可发布，代码块内 br 不计为空段落", () => {
    expect(hasVisibleMarkdownContent("```\n代码\n```\n")).toBe(true);
    expect(hasVisibleMarkdownContent("```\n<br />\n```\n")).toBe(true);
  });

  test("纯数字正文可发布，不会被误判为有序列表前缀", () => {
    expect(hasVisibleMarkdownContent("123")).toBe(true);
    expect(hasVisibleMarkdownContent("1.00")).toBe(true);
  });

  test("只有有序列表标记时仍不可发布", () => {
    expect(hasVisibleMarkdownContent("1.")).toBe(false);
    expect(hasVisibleMarkdownContent("1)")).toBe(false);
  });
});
