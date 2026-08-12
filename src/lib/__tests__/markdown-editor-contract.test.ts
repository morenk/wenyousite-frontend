import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  EDITOR_MOBILE_CAPABILITIES,
  EDITOR_SYNTAX_ONLY,
  EDITOR_WEB_CAPABILITIES,
} from "@/lib/editor-capabilities";

interface EditorRoundTripCase {
  id: string;
  capabilities: string[];
  mode: "structured" | "source-preserve";
  markdown: string;
  serialized: string;
}

const fixture = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "contracts/markdown-editor-roundtrip-v1-fixtures.json",
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
  test("固定在 Markdown v2 之上的编辑器 fixture v1", () => {
    expect(fixture).toMatchObject({
      contract: "wenyousite-markdown-editor-roundtrip",
      version: 1,
      markdownContractVersion: 2,
    });
    expect(new Set(fixture.cases.map((item) => item.id)).size).toBe(
      fixture.cases.length,
    );
  });

  test.each(fixture.cases)("$id 声明明确往返模式且不改变存储正文", (item) => {
    expect(["structured", "source-preserve"]).toContain(item.mode);
    expect(item.capabilities).not.toHaveLength(0);
    expect(item.serialized).toBe(item.markdown);
  });

  test("两端对 Foundation 语法能力都显式声明保留方式", () => {
    for (const capability of EDITOR_SYNTAX_ONLY) {
      expect(EDITOR_WEB_CAPABILITIES[capability].roundTrip).toBe("structured");
      expect(EDITOR_MOBILE_CAPABILITIES[capability].roundTrip).toBe(
        "source-preserve",
      );
    }
  });
});
