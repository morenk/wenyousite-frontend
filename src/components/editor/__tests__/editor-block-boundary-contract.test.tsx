import { CrepeBuilder } from "@milkdown/crepe/builder";
import { imageBlock } from "@milkdown/crepe/feature/image-block";
import { editorViewCtx, parserCtx } from "@milkdown/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { TextSelection } from "@milkdown/kit/prose/state";
import { cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, expect, test } from "vitest";
import fixture from "../../../../contracts/markdown-block-boundary-v1-fixtures.json";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { findUnsupportedMarkdownFormats } from "@/lib/markdown";
import { configureEditorAlignmentParser, configureEditorAlignmentSchemas, createEditorAlignmentPlugin } from "../editor-alignment";
import { configureEditorMarkdownSerializer, createEditorMarkdownBridge, editorSoftBreakParser,
  prepareEditorMarkdown, serializeEditorMarkdown } from "../milkdown-markdown-codec";

async function withEditor(source: string, run: (ctx: Ctx, emitted: string[]) => void) {
  const root = document.createElement("div");
  document.body.append(root);
  const emitted: string[] = [];
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(source) });
  crepe.addFeature(imageBlock);
  crepe.editor.config((ctx) => configureEditorAlignmentParser(ctx, { markdownContractVersion: 5 }))
    .config((ctx) => configureEditorAlignmentSchemas(ctx, { markdownContractVersion: 5 }))
    .config(configureEditorMarkdownSerializer).use(editorSoftBreakParser)
    .use(createEditorAlignmentPlugin(() => {}, () => true))
    .use(createEditorMarkdownBridge({ onChange: (value) => emitted.push(value), onError: (error) => { throw error; } }));
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      // 激活 Milkdown 自带尾段插件后记录初态，保留完整编辑态结构等价断言。
      view.dispatch(view.state.tr);
      run(ctx, emitted);
    });
  } finally { await crepe.destroy(); root.remove(); }
}

function readerDom(source: string) {
  const result = render(<MarkdownContent content={source} />);
  const root = result.container.querySelector('[data-slot="markdown-content"]')!;
  // Crepe 既有图片比例存储会把 alt 规范为数值；本契约的可见图片语义为 [图片]。
  root.querySelectorAll("img").forEach((image) => image.setAttribute("alt", "[图片]"));
  const html = root.innerHTML;
  result.unmount();
  return html;
}

afterEach(cleanup);
afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3_100)); });

test.each(fixture.cases.filter((item) => item.supported))("$id 真实编辑器保存重开与阅读结构相等", async (item) => {
  await withEditor(item.markdown, (ctx) => {
    const view = ctx.get(editorViewCtx);
    const stored = serializeEditorMarkdown(ctx, view.state.doc);
    expect(findUnsupportedMarkdownFormats(stored)).toEqual([]);
    expect(readerDom(stored)).toBe(readerDom(item.markdown));
    expect(readerDom(item.serialized!)).toBe(readerDom(item.markdown));
    const saved = view.state.doc;
    for (let round = 0; round < 3; round++) {
      const parsed = ctx.get(parserCtx)(prepareEditorMarkdown(serializeEditorMarkdown(ctx, view.state.doc)));
      view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, parsed.content));
      expect(view.state.doc.toJSON()).toEqual(saved.toJSON());
      expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(stored);
    }
  });
});

test.each(fixture.editCases)("$id 真实输入事务符合共享语义", async (item) => {
  await withEditor(item.markdown, (ctx, emitted) => {
    const view = ctx.get(editorViewCtx);
    let position = -1;
    view.state.doc.descendants((node, offset) => {
      if (node.text === item.operation.anchor) position = offset + item.operation.offset;
    });
    expect(position).toBeGreaterThan(0);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
    if (item.operation.kind === "insert-text") view.dispatch(view.state.tr.insertText(item.operation.text!));
    else expect(view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })))).toBe(true);
    const stored = serializeEditorMarkdown(ctx, view.state.doc);
    expect(emitted.at(-1)).toBe(stored);
    expect(findUnsupportedMarkdownFormats(stored)).toEqual([]);
    expect(readerDom(stored)).toBe(readerDom(item.serialized));
    const lines: string[] = [], alignments: string[] = [];
    view.state.doc.forEach((node) => { lines.push(node.textContent); alignments.push(node.attrs.textAlign || "left"); });
    expect(lines).toEqual(item.lines);
    expect(alignments).toEqual(item.lineAlignments);
    const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(stored));
    expect(serializeEditorMarkdown(ctx, reopened)).toBe(stored);
  });
});

test.each(fixture.whitespaceCases)("$id 空白字符保存与多轮回填保持原编码", async (item) => {
  await withEditor(item.markdown, (ctx) => {
    let doc = ctx.get(editorViewCtx).state.doc;
    for (let round = 0; round < 3; round++) {
      const stored = serializeEditorMarkdown(ctx, doc);
      expect(stored).toBe(item.serialized);
      doc = ctx.get(parserCtx)(prepareEditorMarkdown(stored));
    }
  });
});

test.each([
  { source: "前文\n[wenyousite-align-v1-center]: #\n`甲\n乙`", lines: ["前文", "甲 乙"], alignments: ["left", "center"] },
  { source: "`甲\n乙`\n[wenyousite-align-v1-center]: #\n正文", lines: ["甲 乙", "正文"], alignments: ["left", "center"] },
  { source: "[wenyousite-align-v1-center]: #\n`甲\n乙`", lines: ["甲 乙"], alignments: ["center"] },
  { source: "`甲\n乙` 和 `丙\n丁`\n[wenyousite-align-v1-center]: #\n正文", lines: ["甲 乙 和 丙 丁", "正文"], alignments: ["left", "center"] },
])("跨行 code 与 marker 邻接的多轮实际回填：$source", async (item) => {
  await withEditor(item.source, (ctx) => {
    const view = ctx.get(editorViewCtx);
    const stored = serializeEditorMarkdown(ctx, view.state.doc);
    for (let round = 0; round < 3; round++) {
      const lines: string[] = [], alignments: string[] = [];
      view.state.doc.forEach((node) => { lines.push(node.textContent); alignments.push(node.attrs.textAlign || "left"); });
      expect(lines).toEqual(item.lines);
      expect(alignments).toEqual(item.alignments);
      expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(stored);
      expect(findUnsupportedMarkdownFormats(stored)).toEqual([]);
      expect(readerDom(stored)).toBe(readerDom(item.source));
      const parsed = ctx.get(parserCtx)(prepareEditorMarkdown(stored));
      view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, parsed.content));
    }
  });
});
