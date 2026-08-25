import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import MarkdownIt from "markdown-it";
import { describe, expect, test } from "vitest";
import {
  EDITOR_MOBILE_CAPABILITIES,
  EDITOR_WEB_CAPABILITIES,
} from "@/lib/editor-capabilities";
import {
  findUnsupportedMarkdownFormats,
  literalizeUnsupportedMarkdown,
} from "@/lib/markdown";

interface EditorRoundTripCase {
  id: string;
  capabilities: string[];
  mode: "structured" | "literal-text";
  markdown: string;
  serialized: string;
  blockSemantics?: string[];
}

const markdownParser = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
});

function parseBlockSemantics(markdown: string): string[] {
  const semantics: string[] = [];
  for (const token of markdownParser.parse(markdown, {})) {
    switch (token.type) {
      case "paragraph_open":
        semantics.push("paragraph");
        break;
      case "heading_open":
        semantics.push(`heading-${token.tag.slice(1)}`);
        break;
      case "hr":
        semantics.push("horizontal-rule");
        break;
      case "blockquote_open":
        semantics.push("blockquote");
        break;
      case "bullet_list_open":
        semantics.push("bullet-list");
        break;
      case "ordered_list_open":
        semantics.push("ordered-list");
        break;
    }
  }
  return semantics;
}

const fixture = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "contracts/markdown-editor-roundtrip-v4-fixtures.json",
    ),
    "utf8",
  ),
) as {
  contract: string;
  version: number;
  markdownContractVersion: number;
  cases: EditorRoundTripCase[];
};

describe("Markdown 编辑器往返契约", () => {
  test("固定在 Markdown v3 之上的编辑器 fixture v4", () => {
    expect(fixture).toMatchObject({
      contract: "wenyousite-markdown-editor-roundtrip",
      version: 4,
      markdownContractVersion: 3,
    });
    expect(new Set(fixture.cases.map((item) => item.id)).size).toBe(
      fixture.cases.length,
    );
  });

  test.each(fixture.cases)("$id 声明明确往返模式并保持结构语义", (item) => {
    expect(["structured", "literal-text"]).toContain(item.mode);
    expect(item.capabilities).not.toHaveLength(0);
    expect(findUnsupportedMarkdownFormats(item.serialized)).toEqual([]);
    expect(literalizeUnsupportedMarkdown(item.serialized)).toBe(item.serialized);

    if (item.mode === "literal-text") {
      expect(literalizeUnsupportedMarkdown(item.markdown)).toBe(item.serialized);
    } else {
      expect(findUnsupportedMarkdownFormats(item.markdown)).toEqual([]);
      expect(literalizeUnsupportedMarkdown(item.markdown)).toBe(item.markdown);
    }

    if (item.blockSemantics) {
      expect(parseBlockSemantics(item.markdown)).toEqual(item.blockSemantics);
      expect(parseBlockSemantics(item.serialized)).toEqual(item.blockSemantics);
    }
  });

  test("分隔线和历史 Setext 以实际块语义消除标点歧义", () => {
    expect(fixture.cases.find((item) => item.id === "horizontal-rule")).toMatchObject({
      markdown: "正文\n\n---\n\n正文",
      serialized: "正文\n\n---\n\n正文",
      blockSemantics: ["paragraph", "horizontal-rule", "paragraph"],
    });
    expect(fixture.cases.find((item) => item.id === "setext-heading-2")).toMatchObject({
      markdown: "正文\n---",
      serialized: "## 正文",
      blockSemantics: ["heading-2"],
    });
  });

  test("Foundation 两端只声明工具栏内结构化能力", () => {
    for (const capability of ["task-list", "code-block", "table"]) {
      expect(EDITOR_WEB_CAPABILITIES).not.toHaveProperty(capability);
      expect(EDITOR_MOBILE_CAPABILITIES).not.toHaveProperty(capability);
    }
  });
});
