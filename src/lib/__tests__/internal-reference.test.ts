import { describe, expect, test } from "vitest";
import fixture from "../../../contracts/internal-reference-v1-fixtures.json";
import {
  formatInternalReferencePreview,
  insertTextAtSelection,
  parseInternalReference,
  serializeInternalReference,
  tokenizeInternalReferenceText,
} from "@/lib/internal-reference";

describe("internal reference v1 contract", () => {
  test.each(fixture.cases)("$id", ({ input, recognized, kind, canonical }) => {
    const parsed = parseInternalReference(input);
    expect(!!parsed).toBe(recognized);
    if (recognized) {
      expect(parsed?.kind).toBe(kind);
      expect(parsed?.href).toBe(canonical);
    }
  });

  test.each(fixture.renderingCases)("$id rendering", ({ source, visibleText, portalCount }) => {
    const segments = tokenizeInternalReferenceText(source);
    expect(formatInternalReferencePreview(source)).toBe(visibleText);
    expect(segments.filter((segment) => segment.type === "portal")).toHaveLength(portalCount);
  });

  test("序列化时使用相对规范地址并转义名称", () => {
    expect(serializeInternalReference(
      "设定 [A]",
      "https://wenyou.site/threads/cmsewdo0h000x7qv6aa77ll1v",
    )).toBe("[设定 \\[A\\]](/threads/cmsewdo0h000x7qv6aa77ll1v)");
  });

  test("在当前选择处替换文本并返回新光标", () => {
    expect(insertTextAtSelection("前文选中文字后文", "[目录](/threads/x)", 2, 6)).toEqual({
      value: "前文[目录](/threads/x)后文",
      cursor: 18,
    });
  });
});
