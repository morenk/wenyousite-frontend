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

function getLastRule(css: string, selector: string): string {
  const start = css.lastIndexOf(`${selector} {`);
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

  test("编辑态与发布态的引用块均映射为 Foundation 书签纸条", () => {
    const editorQuote = getRule(editorCss, ".milkdown .ProseMirror blockquote");
    const publishedQuote = getRule(globalCss, ".wenyou-prose blockquote");

    for (const rule of [editorQuote, publishedQuote]) {
      expect(rule).toContain("inline-size: 100%");
      expect(rule).toContain(
        "border-inline-start: var(--element-quote-marker-width) solid var(--element-quote-marker)",
      );
      expect(rule).toContain("border-start-start-radius: 0");
      expect(rule).toContain("border-end-start-radius: 0");
      expect(rule).toContain("border-start-end-radius: var(--element-quote-radius)");
      expect(rule).toContain("border-end-end-radius: var(--element-quote-radius)");
      expect(rule).toContain("background: var(--element-quote-surface)");
      expect(rule).toContain("color: var(--element-quote-foreground)");
      expect(rule).toContain("font-style: normal");
      expect(rule).toContain("font-synthesis: none");
      expect(rule).toContain("font-weight: var(--element-quote-font-weight)");
      expect(rule).toContain("var(--element-quote-padding-block)");
      expect(rule).toContain("var(--element-quote-padding-inline)");
      expect(rule).toContain("box-shadow: none");
      expect(rule).not.toContain("var(--primary)");
      expect(rule).not.toContain("var(--font-display)");
    }

    expect(getRule(globalCss, ".wenyou-prose blockquote > :first-child"))
      .toContain("margin-block-start: 0");
    expect(getRule(globalCss, ".wenyou-prose blockquote > :last-child"))
      .toContain("margin-block-end: 0");
    expect(getRule(editorCss, ".milkdown .ProseMirror blockquote > :first-child"))
      .toContain("padding-block-start: 0");
    expect(getRule(editorCss, ".milkdown .ProseMirror blockquote > :last-child"))
      .toContain("padding-block-end: 0");
  });

  test("编辑态与发布态的正文分隔线均为居中短线圆点", () => {
    for (const [css, selector] of [
      [editorCss, ".milkdown .ProseMirror hr"],
      [globalCss, ".wenyou-prose hr"],
    ] as const) {
      const divider = getRule(css, selector);
      const generated = getRule(css, `${selector}::before,\n${selector}::after`);
      const line = getRule(css, `${selector}::before`);
      const marker = getLastRule(css, `${selector}::after`);

      expect(divider).toContain("inline-size: min(var(--element-divider-inline-size), 100%)");
      expect(divider).toContain("block-size: var(--element-divider-marker-size)");
      expect(divider).toContain("margin-block: var(--element-divider-spacing-block)");
      expect(divider).toContain("margin-inline: auto");
      expect(divider).toContain("border: 0");
      expect(generated).toContain('content: ""');
      expect(line).toContain("block-size: var(--element-divider-width)");
      expect(line).toContain("background: var(--element-divider-color)");
      expect(marker).toContain("inline-size: var(--element-divider-marker-size)");
      expect(marker).toContain("background: var(--element-divider-marker)");
      expect(marker).toContain("border-radius: 50%");
      expect(divider).not.toContain("solid var(--border)");
    }
  });
});
