import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { MarkdownContent } from "@/components/thread/markdown-content";

afterEach(cleanup);

test.each([
  ["正文", "", "p"],
  ["H2", "## ", "h2"],
  ["H3", "### ", "h3"],
  ["引用", "> ", "blockquote p"],
  ["列表", "- ", "li"],
])("%s DOM 保留长空格、NBSP、全角空格和 WJ", (_kind, prefix, selector) => {
  const text = `\u2060${" ".repeat(60)}何${" ".repeat(14)}鬼\u00a0\u3000🙂   \u2060`;
  const { container } = render(<MarkdownContent content={prefix + text} />);
  expect(container.querySelector(selector)!.textContent).toBe(text);
});

test("软换行只输出 br，不附带会被保留空白样式再次显示的 LF", () => {
  const { container } = render(<MarkdownContent content={"甲   乙\n丙   丁"} />);
  const paragraph = container.querySelector("p")!;
  expect(paragraph.querySelectorAll("br")).toHaveLength(1);
  expect(paragraph.textContent).toBe("甲   乙丙   丁");
});

test("紧凑列表中的排版 LF 不增加可见空行", () => {
  const { container } = render(<MarkdownContent content={"- 第一   项\n  - 第二   项"} />);
  const list = container.querySelector("ul")!;
  expect(list.textContent).toBe("第一   项第二   项");
  expect(list.querySelectorAll("br")).toHaveLength(0);
});

test("软换行后保留每行的 24 个实体空格，不把续行缩进裁掉", () => {
  const lines = ["低  举  疑  床", "头  头  是  前", "思  望  地  明", "故  明  上  月", "乡  月  霜  光", "。  ，  。  ，"];
  const content = lines.map((line) => "&#32;".repeat(24) + line).join("\n");
  const { container } = render(<MarkdownContent content={content} />);
  const paragraph = container.querySelector("p")!;
  expect(paragraph.querySelectorAll("br")).toHaveLength(lines.length - 1);
  expect(Array.from(paragraph.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent))
    .toEqual(lines.map((line) => " ".repeat(24) + line));
});

test.each([
  ["实体", "&#32;&#x20;&#0000032;", "   "],
  ["全角与 NBSP", "\u3000\u00a0&#32;", "\u3000\u00a0 "],
])("软换行后保留%s空格及后续格式节点", (_kind, prefix, expected) => {
  const { container } = render(<MarkdownContent content={"甲\n" + prefix + "**乙**"} />);
  const paragraph = container.querySelector("p")!;
  expect(paragraph.querySelectorAll("br")).toHaveLength(1);
  expect(paragraph.textContent).toBe("甲" + expected + "乙");
  expect(paragraph.querySelector("strong")!.textContent).toBe("乙");
});

test("换行不解码代码及转义实体字面，也不改变普通行内空格", () => {
  const code = String.fromCharCode(96);
  const { container } = render(<MarkdownContent content={"甲  乙\n" + code + "&#32;  代码" + code + "\n\\&#32;  字面"} />);
  const paragraph = container.querySelector("p")!;
  expect(paragraph.querySelectorAll("br")).toHaveLength(2);
  expect(paragraph.querySelector("code")!.textContent).toBe("&#32;  代码");
  expect(paragraph.textContent).toBe("甲  乙&#32;  代码&#32;  字面");
});

test("协议空段仍只生成一条空白行，不添加占位文字", () => {
  const { container } = render(<MarkdownContent content={"甲\n<br />\n&#32;&#32;乙"} />);
  expect(container.querySelectorAll("[data-wenyou-empty-row] br")).toHaveLength(1);
  expect(Array.from(container.querySelectorAll("p")).map((node) => node.textContent)).toEqual(["甲", "", "  乙"]);
});
