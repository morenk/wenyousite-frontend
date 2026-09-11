import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { MarkdownContent } from "../markdown-content";
const fixtures = JSON.parse(readFileSync("contracts/rich-text-behavior-v1-fixtures.json", "utf8")) as {
  cases: Array<{ id: string; initial: { canonical: string } }>;
};
const source = (id: string) => fixtures.cases.find((item) => item.id === id)!.initial.canonical;
afterEach(cleanup);

test("共享字面标记样例在阅读态保留行内代码与 Unicode 空白", () => {
  const { container } = render(<MarkdownContent content={source("rtb-literal-markers-whitespace")} />);
  const paragraphs = container.querySelectorAll("p");
  expect(paragraphs).toHaveLength(2);
  expect(paragraphs[0].textContent).toBe("> 引用源码 > <br />");
  expect(paragraphs[0].querySelector("code")?.textContent).toBe("> <br />");
  expect(paragraphs[1].textContent).toBe("\u00a0甲\u00a0");
  expect(container.querySelector("blockquote")).toBeNull();
});

test("共享引用分段阅读保持两段归属，没有额外空段", () => {
  const { container } = render(<MarkdownContent content={source("rtb-quote-paragraph-membership")} />);
  const quote = container.querySelector("blockquote")!;
  expect([...quote.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["甲", "乙"]);
  expect(container.querySelectorAll("p")).toHaveLength(2);
});
