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
      ".wenyou-prose :is(h1, h2, h3, h4, h5, h6)",
    );

    expect(editorCss).toContain("--crepe-font-title: var(--font-sans)");
    expect(editorHeadings).toContain("font-family: var(--font-sans)");
    expect(publishedHeadings).toContain("font-family: var(--font-sans)");
    expect(editorHeadings).not.toContain("var(--font-display)");
    expect(publishedHeadings).not.toContain("var(--font-display)");
  });

  test("工具栏依靠能力收纳保持单行，不开放横向滑动", () => {
    const topBar = getRule(editorCss, ".milkdown .milkdown-top-bar");

    expect(topBar).toContain("flex-wrap: nowrap");
    expect(topBar).toContain("overflow: visible");
    expect(topBar).not.toMatch(/overflow-x:\s*(?:auto|scroll)/u);
  });

  test("Crepe 顶栏保持 Foundation Lucide 的无填充描边", () => {
    const iconRule = getRule(
      editorCss,
      ".milkdown .milkdown-top-bar :is(.top-bar-item, .top-bar-chevron) svg.lucide",
    );

    expect(iconRule).toContain("fill: none");
    expect(iconRule).toContain("stroke: currentColor");
  });

  test("正文首列与工具栏首项共用居中内容列", () => {
    const milkdown = getRule(editorCss, ".milkdown");
    const proseMirror = getRule(editorCss, ".milkdown .ProseMirror");
    const topBar = getRule(editorCss, ".milkdown .milkdown-top-bar");
    const topBarInner = getRule(
      editorCss,
      ".milkdown .milkdown-top-bar .top-bar-inner",
    );

    expect(milkdown).toContain(
      "--editor-content-max-width: var(--editor-frame-max)",
    );
    expect(proseMirror).toContain("max-width: var(--editor-content-max-width)");
    expect(proseMirror).toContain(
      "padding: 16px var(--editor-content-inline-padding)",
    );
    expect(topBar).toContain("padding-inline: 0");
    expect(topBarInner).toContain("max-width: var(--editor-content-max-width)");
    expect(topBarInner).toContain("margin-inline: auto");
    expect(topBarInner).toContain(
      "padding-inline: var(--editor-toolbar-inline-padding)",
    );
  });

  test("编辑器框架放宽时正文仍使用发布态测量宽度", () => {
    const proseChildren = getRule(editorCss, ".milkdown .ProseMirror > *");
    const published = getRule(globalCss, ".wenyou-prose");

    expect(proseChildren).toContain("max-width: var(--editor-text-measure)");
    expect(published).toContain("max-width: 40em");
  });

  test("编辑态与发布态的引用块均使用正常字形和元素 Token", () => {
    const editorQuote = getRule(editorCss, ".milkdown .ProseMirror blockquote");
    const publishedQuote = getRule(globalCss, ".wenyou-prose blockquote");

    for (const rule of [editorQuote, publishedQuote]) {
      expect(rule).toContain("font-style: normal");
      expect(rule).toContain("font-synthesis: none");
      expect(rule).toContain("var(--element-quote-padding-block)");
    }
  });
});
