/** sanitizeEmptyImages 工具函数测试 */

import { describe, test, expect } from "vitest";
import {
  sanitizeEmptyImages,
  findUnsupportedMarkdownFormats,
  hasVisibleMarkdownContent,
  literalizeUnsupportedMarkdown,
  prepareMilkdownEditorMarkdown,
  prepareMarkdownForReader,
  recoverLegacyMarkdownEmptyParagraphs,
  sanitizeMilkdownMarkdown,
} from "@/lib/markdown";
import { normalizeSerializedAlignmentMarkers } from "@/lib/markdown-alignment";
import markdownV4Fixtures from "../../../contracts/markdown-v4-fixtures.json";

type MarkdownFixture = (typeof markdownV4Fixtures.cases)[number];
const MARKDOWN_V4_OPTIONS = { markdownContractVersion: 4 };

describe("Markdown v4 黄金语料", () => {
  test("协议版本正确且 case id 唯一", () => {
    expect(markdownV4Fixtures.contract).toBe("wenyousite-markdown");
    expect(markdownV4Fixtures.version).toBe(4);
    expect(new Set(markdownV4Fixtures.cases.map(({ id }) => id)).size).toBe(
      markdownV4Fixtures.cases.length,
    );
  });

  test.each(markdownV4Fixtures.cases)(
    "$id 字面降级为 literal 且保持幂等",
    ({ input, literal }: MarkdownFixture) => {
      expect(sanitizeMilkdownMarkdown(input, MARKDOWN_V4_OPTIONS)).toBe(literal);
      expect(sanitizeMilkdownMarkdown(literal, MARKDOWN_V4_OPTIONS)).toBe(literal);
    },
  );

  test.each(markdownV4Fixtures.cases)(
    "$id 的发布可见性符合协议",
    ({ input, canonical, visible }: MarkdownFixture) => {
      expect(hasVisibleMarkdownContent(input)).toBe(visible);
      expect(hasVisibleMarkdownContent(canonical)).toBe(visible);
    },
  );

  test.each(markdownV4Fixtures.cases)(
    "$id 白名单结果与首个不支持类型一致",
    ({ canonical, supported, unsupportedType }: MarkdownFixture) => {
      expect(findUnsupportedMarkdownFormats(canonical, MARKDOWN_V4_OPTIONS)[0]?.type ?? null).toBe(
        unsupportedType,
      );
      expect(findUnsupportedMarkdownFormats(
        literalizeUnsupportedMarkdown(canonical, MARKDOWN_V4_OPTIONS),
        MARKDOWN_V4_OPTIONS,
      )).toEqual([]);
      expect(supported).toBe(unsupportedType === null);
    },
  );
});

describe("对齐标记序列化", () => {
  test("移除 stringifier 空行且保留正文自身的行首空白", () => {
    expect(normalizeSerializedAlignmentMarkers(
      "[wenyousite-align-v1-center]: #\n\n  正文",
    )).toBe("[wenyousite-align-v1-center]: #\n  正文");
  });
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

  test("正文行内显式 br 降为可见字面文本", () => {
    expect(sanitizeMilkdownMarkdown("正文 <br /> 示例")).toBe(
      "正文 \\<br \\/\\> 示例",
    );
  });

  test("围栏代码块逐行降为普通段落", () => {
    const markdown =
      "```html\n<br />\n![empty]()\n```\n\n~~~html\n<br>\n![empty]( )\n~~~";
    const literal = sanitizeMilkdownMarkdown(markdown);
    expect(literal).not.toContain("```html");
    expect(findUnsupportedMarkdownFormats(literal)).toEqual([]);
  });

  test("嵌套任务项与同段内每个硬换行都会逐行降级", () => {
    const task = "- 普通项目\n  - [ ] 嵌套任务";
    expect(findUnsupportedMarkdownFormats(task)[0]?.type).toBe("task-list");
    expect(sanitizeMilkdownMarkdown(task)).toContain(
      "\n\n  \\- \\[ \\] 嵌套任务",
    );

    const hardBreaks = "第一行  \n第二行\\\n第三行";
    expect(findUnsupportedMarkdownFormats(hardBreaks)).toEqual([
      { type: "hard-break", startLine: 0, endLine: 0 },
      { type: "hard-break", startLine: 1, endLine: 1 },
    ]);
    expect(findUnsupportedMarkdownFormats(sanitizeMilkdownMarkdown(hardBreaks))).toEqual([]);
  });

  test("清理空 URL 图片但保留空段落", () => {
    expect(sanitizeMilkdownMarkdown("![1.00]()\n\n<br />\n正文")).toBe(
      "\n\n<br />\n正文",
    );
  });
});

describe("recoverLegacyMarkdownEmptyParagraphs", () => {
  test("保留普通段落边界，只恢复内部多余空行", () => {
    expect(recoverLegacyMarkdownEmptyParagraphs("第一段\n\n第二段")).toBe(
      "第一段\n\n第二段",
    );
    expect(recoverLegacyMarkdownEmptyParagraphs("第一段\n\n\n第二段")).toBe(
      "第一段\n\n<br />\n\n第二段",
    );
    expect(recoverLegacyMarkdownEmptyParagraphs("第一段\n\n\n\n第二段")).toBe(
      "第一段\n\n<br />\n\n<br />\n\n第二段",
    );
  });

  test("逐个恢复首部空行，尾部只忽略一个格式化换行", () => {
    expect(recoverLegacyMarkdownEmptyParagraphs("\n\n正文")).toBe(
      "<br />\n\n<br />\n\n正文",
    );
    expect(recoverLegacyMarkdownEmptyParagraphs("正文\n")).toBe("正文\n");
    expect(recoverLegacyMarkdownEmptyParagraphs("正文\n\n\n")).toBe(
      "正文\n\n<br />\n\n<br />",
    );
  });

  test("显式协议标记幂等且统一跨平台换行", () => {
    const canonical = "第一段\n\n<br />\n<br />\n\n第二段";
    expect(recoverLegacyMarkdownEmptyParagraphs(canonical)).toBe(canonical);
    expect(
      recoverLegacyMarkdownEmptyParagraphs("第一段\r\n\r\n\r\n第二段"),
    ).toBe("第一段\n\n<br />\n\n第二段");
  });

  test("围栏和缩进代码中的空行不参与历史恢复", () => {
    const fenced = "```text\n第一行\n\n\n第二行\n```";
    const indented = "    第一行\n\n\n    第二行";
    expect(recoverLegacyMarkdownEmptyParagraphs(fenced)).toBe(fenced);
    expect(recoverLegacyMarkdownEmptyParagraphs(indented)).toBe(indented);
  });
});

describe("prepareMilkdownEditorMarkdown", () => {
  test("将相邻空段标记隔开供 Milkdown 逐段恢复", () => {
    expect(
      prepareMilkdownEditorMarkdown(
        "第一段\n\n<br />\n<br>\n<br/>\n\n第二段",
      ),
    ).toBe(
      "第一段\n\n<br />\n\n<br />\n\n<br />\n\n第二段",
    );
  });

  test("历史原始空行在进入编辑器前转换为协议空段", () => {
    expect(prepareMilkdownEditorMarkdown("第一段\n\n\n\n第二段")).toBe(
      "第一段\n\n<br />\n\n<br />\n\n第二段",
    );
  });
});

describe("prepareMarkdownForReader", () => {
  test("隔离开头连续协议空段与正文", () => {
    expect(prepareMarkdownForReader("<br />\n正文")).toBe(
      "<br />\n\n正文",
    );
    expect(prepareMarkdownForReader("<br>\n<br/>\n正文")).toBe(
      "<br />\n<br />\n\n正文",
    );
  });

  test("已有分隔或正文中的协议空段不改写", () => {
    const separated = "<br />\n\n正文";
    const inline = "第一行\n<br />\n第二行";

    expect(prepareMarkdownForReader(separated)).toBe(separated);
    expect(prepareMarkdownForReader(inline)).toBe(inline);
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
