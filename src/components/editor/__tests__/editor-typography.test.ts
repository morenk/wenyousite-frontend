import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const editorCss = readFileSync(
  resolve(process.cwd(), "src/components/editor/milkdown-editor.css"),
  "utf8",
);
const globalCss = readFileSync(
  resolve(process.cwd(), "src/app/globals.css"),
  "utf8",
);

function getRule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return "";
  const end = css.indexOf("}", start);
  return end < 0 ? "" : css.slice(start, end + 1);
}

describe("编辑器正文字体", () => {
  test("编辑态与发布态的斜体使用倾斜样式而非展示字体", () => {
    const editorItalic = getRule(editorCss, ".milkdown .ProseMirror em");
    const publishedItalic = getRule(globalCss, ".wenyou-prose em");

    for (const rule of [editorItalic, publishedItalic]) {
      expect(rule).toContain("font-family: var(--font-sans)");
      expect(rule).toContain("font-style: italic");
      expect(rule).toContain("font-synthesis: style");
      expect(rule).not.toContain("var(--font-display)");
      expect(rule).not.toContain("font-style: normal");
    }
  });

  test("编辑器内的 Markdown 标题也属于正文，不使用霞鹜文楷", () => {
    const editorHeadings = getRule(
      editorCss,
      ".milkdown .ProseMirror :is(h1, h2, h3, h4, h5, h6)",
    );
    const publishedHeadings = getRule(
      globalCss,
      ".wenyou-prose :is(h1, h2, h3, h4)",
    );

    expect(editorCss).toContain("--crepe-font-title: var(--font-sans)");
    expect(editorHeadings).toContain("font-family: var(--font-sans)");
    expect(publishedHeadings).toContain("font-family: var(--font-sans)");
    expect(editorHeadings).not.toContain("var(--font-display)");
    expect(publishedHeadings).not.toContain("var(--font-display)");
  });

  test("编辑态与发布态的引用块均使用斜体", () => {
    const editorQuote = getRule(editorCss, ".milkdown .ProseMirror blockquote");
    const publishedQuote = getRule(globalCss, ".wenyou-prose blockquote");

    for (const rule of [editorQuote, publishedQuote]) {
      expect(rule).toContain("font-style: italic");
      expect(rule).toContain("font-synthesis: style");
      expect(rule).not.toContain("font-style: normal");
    }
  });
});
