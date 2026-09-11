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
