import { expect, test } from "vitest";
import fixture from "../../../contracts/markdown-block-boundary-v1-fixtures.json";
import { analyzeMarkdownBlockBoundaries, projectMarkdownBlockBoundaries } from "../markdown-block-boundaries";
import { findUnsupportedMarkdownFormats, sanitizeMilkdownMarkdown } from "../markdown";

test.each(fixture.cases)("$id 共享校验结果与原始行号", (item) => {
  const issues = findUnsupportedMarkdownFormats(item.markdown);
  if (!item.supported) {
    expect(issues[0]).toEqual(item.error);
    const literal = sanitizeMilkdownMarkdown(item.markdown);
    expect(findUnsupportedMarkdownFormats(literal)).toEqual([]);
    expect(sanitizeMilkdownMarkdown(literal)).toBe(literal);
    return;
  }
  expect(issues).toEqual([]);
  const analysis = analyzeMarkdownBlockBoundaries(item.markdown);
  expect(analysis.boundaries).toEqual(item.blocks!.filter((block) => block.markerLine !== null)
    .map(({ type, alignment, startLine, endLine, markerLine }) => ({ type, alignment, startLine, endLine, markerLine })));
  const projected = projectMarkdownBlockBoundaries(item.markdown);
  const original = item.markdown.replace(/\r\n?/gu, "\n").split("\n");
  projected.markdown.split("\n").forEach((line, index) => {
    const sourceLine = projected.sourceLines[index];
    expect(line).toBe(sourceLine == null ? "" : original[sourceLine]);
  });
});

test.each([
  "[链接](https://example.com/`)",
  '![图片](https://example.com/`)',
  '[链接](https://example.com "`标题")',
])("URL/title 的反引号不把后续 marker 误判为代码：%s", (prefix) => {
  const markdown = `${prefix}\n[wenyousite-align-v1-center]: #\n正文 \`code\``;
  const result = analyzeMarkdownBlockBoundaries(markdown);
  expect(result.boundaries).toEqual([{ alignment: "center", markerLine: 1, startLine: 2, endLine: 2, type: "paragraph" }]);
  expect(findUnsupportedMarkdownFormats(markdown)).toEqual([]);
});

test.each(["`", "``"])("跨行行内代码中的 br 与 marker 均不成为块边界：%s", (delimiter) => {
  const source = `${delimiter}前文\n<br />\n[wenyousite-align-v1-center]: #\n正文${delimiter}`;
  const analysis = analyzeMarkdownBlockBoundaries(source);
  expect(analysis.boundaries).toEqual([]);
  expect(analysis.markerLines.size).toBe(0);
  expect(findUnsupportedMarkdownFormats(source)).toEqual([]);
});

test.each(["-", ">"])("容器 %s 的惰性续行代码保护真实 inline 范围", (prefix) => {
  const source = `${prefix} \`甲\n[wenyousite-align-v1-center]: #\n乙\``;
  const analysis = analyzeMarkdownBlockBoundaries(source);
  expect(analysis.boundaries).toEqual([]);
  expect(analysis.markerLines.size).toBe(0);
  expect(analysis.protectedLines.has(1)).toBe(true);
  expect(findUnsupportedMarkdownFormats(source)).toEqual([]);
});

test.each([
  { source: "前文\n[wenyousite-align-v1-center]: #\n`甲\n乙`", map: [1, 2, 3] },
  { source: "`甲\n乙`\n[wenyousite-align-v1-center]: #\n正文", map: [2, 3, 3] },
  { source: "[wenyousite-align-v1-center]: #\n`甲\n乙`", map: [0, 1, 2] },
  { source: "`甲\n乙` 和 `丙\n丁`\n[wenyousite-align-v1-center]: #\n正文", map: [3, 4, 4] },
])("跨行 code 与 marker 邻接保留原始位置：$source", ({ source, map }) => {
  expect(findUnsupportedMarkdownFormats(source)).toEqual([]);
  expect(analyzeMarkdownBlockBoundaries(source).boundaries).toEqual([{
    alignment: "center", markerLine: map[0], startLine: map[1], endLine: map[2], type: "paragraph",
  }]);
});
