import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import fixtures from "../../../contracts/markdown-text-color-v1-fixtures.json";
import { findUnsupportedMarkdownFormats, prepareMilkdownEditorMarkdown } from "../markdown";
import { assessEditorInput } from "../editor-content-compatibility";
import { hasTextColorSource } from "../markdown-text-color";
import { MarkdownContent } from "@/components/thread/markdown-content";

describe("文本颜色 v1 固定契约", () => {
  test.each(fixtures.validCases)("$id 接受受控标签并保留其他 Markdown", ({ source }) => {
    expect(findUnsupportedMarkdownFormats(source)).toEqual([]);
    expect(findUnsupportedMarkdownFormats(prepareMilkdownEditorMarkdown(source))).toEqual([]);
  });
  test.each(fixtures.invalidSources)("拒绝非法颜色 %s", (source) => {
    expect(findUnsupportedMarkdownFormats(source).length).toBeGreaterThan(0);
  });
  test("仅真实标签触发能力保护", () => {
    expect(hasTextColorSource('<span data-wenyou-color-v1="#123456">字</span>')).toBe(true);
    expect(hasTextColorSource('`<span data-wenyou-color-v1="#123456">字</span>`')).toBe(false);
    expect(hasTextColorSource('\\<span data-wenyou-color-v1="#123456">字\\</span>')).toBe(false);
  });
  test("阅读只渲染受控颜色，保留粗斜体、链接与代码", () => {
    const { container } = render(<MarkdownContent content={'<span data-wenyou-color-v1="#a1b2c3">**粗体** *斜体* ~~删除~~ [链接](https://example.com) `<字面>`</span>'} />);
    const color = container.querySelector('[data-wenyou-color-v1="#A1B2C3"]');
    expect(color).toHaveStyle({ color: "#A1B2C3" });
    expect(color?.querySelector("strong")).toHaveTextContent("粗体");
    expect(color?.querySelector("em")).toHaveTextContent("斜体");
    expect(color?.querySelector("del")).toHaveTextContent("删除");
    expect(color?.querySelector("a")).toHaveAttribute("href", "https://example.com");
    expect(color?.querySelector("code")).toHaveTextContent("<字面>");
  });
  test.each(fixtures.invalidSources)("阅读不执行非法颜色 %s", (source) => {
    const { container } = render(<MarkdownContent content={source} />);
    expect(container.querySelector("[data-wenyou-color-v1]")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
  });
});

test("不支持颜色的服务不能覆盖源，缺省为关闭", () => {
  const source = '<span data-wenyou-color-v1="#123456">中文</span>';
  expect(assessEditorInput(source, 5).edit).toBe(false);
  expect(assessEditorInput(source, 5, false).edit).toBe(false);
  expect(assessEditorInput(source, 5, true).edit).toBe(true);
  expect(assessEditorInput("普通正文", 5).edit).toBe(true);
});

test.each([
  String.raw`\@全体玩家`,
  String.raw`\[\[dice:v1:11111111-1111-4111-8111-111111111111:1d6\]\]`,
  String.raw`\/threads/c111111111111111111111111`,
])("转义字面 %s 在阅读层保留颜色，不转换成原子内容", (literal) => {
  const source = `<span data-wenyou-color-v1="#D14343">**${literal}**</span>`;
  expect(findUnsupportedMarkdownFormats(source)).toEqual([]);
  expect(hasTextColorSource(source)).toBe(true);
  const { container } = render(<MarkdownContent content={source} />);
  expect(container.querySelector('[data-wenyou-color-v1]')).toHaveTextContent(literal.replaceAll("\\", ""));
  expect(container.querySelector("a,[data-dice-node-id]")).toBeNull();
  expect(findUnsupportedMarkdownFormats(source.replaceAll("\\", "").replaceAll("**", "")).length).toBeGreaterThan(0);
});
