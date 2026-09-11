import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import fixture from "../../../../contracts/markdown-block-boundary-v1-fixtures.json";
import { MarkdownContent } from "../markdown-content";

afterEach(cleanup);

function visibleText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node instanceof Element) {
    if (node.tagName === "BR") return "\n";
    if (node.getAttribute("data-wenyou-media") === "image") return "[图片]";
  }
  return Array.from(node.childNodes).map(visibleText).join("");
}

test.each(fixture.cases.filter((item) => item.supported))("$id 实际阅读块与可见行符合共享契约", (item) => {
  const { container } = render(<MarkdownContent content={item.markdown} />);
  const root = container.querySelector('[data-slot="markdown-content"]')!;
  const blocks = Array.from(root.children).map((element) => {
    let type: string = ({ P: "paragraph", H2: "heading-2", H3: "heading-3", UL: "bullet-list",
      BLOCKQUOTE: "blockquote", HR: "horizontal-rule" } as Record<string, string>)[element.tagName]!;
    if (element.querySelector('[data-wenyou-media="image"]')) type = "image";
    const text = visibleText(element);
    if (type === "paragraph" && text === "\n") type = "empty-paragraph";
    const lines = type === "horizontal-rule" ? [] : type === "empty-paragraph" ? [""] : text.split("\n");
    return { type, alignment: element.getAttribute("data-wenyou-align") ?? "left", lines };
  });
  expect(blocks).toEqual(item.blocks!.map(({ type, alignment, lines }) => ({ type, alignment, lines })));
  expect(blocks.flatMap((block) => block.lines)).toEqual(item.lines);
  expect(blocks.flatMap((block) => block.lines.map(() => block.alignment))).toEqual(item.lineAlignments);
  expect(blocks.flatMap((block) => block.lines).join("\n")).toBe(item.visibleText);
});

test.each(fixture.whitespaceCases)("$id 空白字符与软换行逐行保留", (item) => {
  const { container } = render(<MarkdownContent content={item.markdown} />);
  const paragraph = container.querySelector("p")!;
  // fixture 的可见文本忽略不可见 WJ；原字符由空白 DOM 与编辑器字节往返测试约束。
  expect(visibleText(paragraph).replace(/\u2060/gu, "").split("\n")).toEqual(item.lines);
});
