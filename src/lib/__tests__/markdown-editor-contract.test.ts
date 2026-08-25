import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
}

const fixture = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "contracts/markdown-editor-roundtrip-v3-fixtures.json",
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
  test("固定在 Markdown v3 之上的编辑器 fixture v3", () => {
    expect(fixture).toMatchObject({
      contract: "wenyousite-markdown-editor-roundtrip",
      version: 3,
      markdownContractVersion: 3,
    });
    expect(new Set(fixture.cases.map((item) => item.id)).size).toBe(
      fixture.cases.length,
    );
  });

  test.each(fixture.cases)("$id 声明明确往返模式且不改变存储正文", (item) => {
    expect(["structured", "literal-text"]).toContain(item.mode);
    expect(item.capabilities).not.toHaveLength(0);
    expect(findUnsupportedMarkdownFormats(item.serialized)).toEqual([]);
    expect(literalizeUnsupportedMarkdown(item.markdown)).toBe(item.serialized);
  });

  test("Foundation 两端只声明工具栏内结构化能力", () => {
    for (const capability of ["task-list", "code-block", "table"]) {
      expect(EDITOR_WEB_CAPABILITIES).not.toHaveProperty(capability);
      expect(EDITOR_MOBILE_CAPABILITIES).not.toHaveProperty(capability);
    }
  });
});
