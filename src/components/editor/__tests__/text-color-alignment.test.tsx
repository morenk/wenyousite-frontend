import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx, parserCtx } from "@milkdown/core";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { TextSelection } from "@milkdown/kit/prose/state";
import { cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, expect, test } from "vitest";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { findUnsupportedMarkdownFormats } from "@/lib/markdown";
import {
  colorAlignmentCases, colored, inline, rgb,
  type ColorBlockSemantics, type InlineColorSemantics,
} from "@/test/rich-text/text-color-alignment-cases";
import { configureTextColorTestEditor, textColorCapability, textColorSemanticJson } from "@/test/rich-text/text-color-editor";
import {
  editorBoundaryTextSchema, editorAttentionBoundaryParser, editorSoftBreakParser,
  prepareEditorMarkdown, serializeEditorMarkdown,
} from "../milkdown-markdown-codec";
import { editorTextColorSchema, editorTextColorAtomicPolicy } from "../editor-text-color";

function append(content: InlineColorSemantics[], next: InlineColorSemantics) {
  const previous = content.at(-1);
  if (previous && JSON.stringify({ ...previous, text: "" }) === JSON.stringify({ ...next, text: "" })) {
    previous.text += next.text;
  } else {
    content.push(next);
  }
}

// 编辑器模型与阅读 DOM 分别提取语义，都与手写 fixture 比较，而非相互充当真值。
function documentSemantics(doc: ProseNode): ColorBlockSemantics[] {
  const blocks: ColorBlockSemantics[] = [];
  doc.forEach((block) => {
    expect(["paragraph", "heading"]).toContain(block.type.name);
    const tag = block.type.name === "paragraph" ? "p" : block.attrs.level === 2 ? "h2" : "h3";
    if (block.type.name === "heading") expect([2, 3]).toContain(block.attrs.level);
    const content: InlineColorSemantics[] = [];
    block.forEach((node) => {
      expect(node.isText || node.type.name === "hardbreak").toBe(true);
      const part = inline(node.text ?? "\n", { color: null });
      for (const mark of node.marks) {
        switch (mark.type.name) {
          case "wenyouTextColor": part.color = mark.attrs.color; break;
          case "strong": part.bold = true; break;
          case "emphasis": part.italic = true; break;
          case "strike_through": part.strike = true; break;
          case "inlineCode": part.code = true; break;
          case "link": part.href = mark.attrs.href; part.title = mark.attrs.title ?? null; break;
          default: throw new Error("未覆盖的 mark：" + mark.type.name);
        }
      }
      append(content, part);
    });
    blocks.push({ tag, align: block.attrs.textAlign, content });
  });
  return blocks;
}

function readerSemantics(container: HTMLElement): ColorBlockSemantics[] {
  const reader = container.querySelector('[data-slot="markdown-content"]')!;
  return Array.from(reader.children).map((block) => {
    const tag = block.tagName.toLowerCase() as ColorBlockSemantics["tag"];
    expect(["p", "h2", "h3"]).toContain(tag);
    const content: InlineColorSemantics[] = [];
    const visit = (node: Node, inherited: InlineColorSemantics) => {
      if (node.nodeType === Node.TEXT_NODE) {
        append(content, { ...inherited, text: node.textContent ?? "" });
        return;
      }
      expect(node instanceof HTMLElement).toBe(true);
      const element = node as HTMLElement;
      if (element.tagName === "BR") {
        append(content, { ...inherited, text: "\n" });
        return;
      }
      const next = { ...inherited };
      if (element.hasAttribute("data-wenyou-color-v1")) next.color = element.getAttribute("data-wenyou-color-v1");
      if (element.tagName === "STRONG") next.bold = true;
      if (element.tagName === "EM") next.italic = true;
      if (element.tagName === "DEL") next.strike = true;
      if (element.tagName === "CODE") next.code = true;
      if (element.tagName === "A") {
        next.href = element.getAttribute("href");
        next.title = element.getAttribute("title");
      }
      element.childNodes.forEach((child) => visit(child, next));
    };
    block.childNodes.forEach((node) => visit(node, inline("", { color: null })));
    return { tag, align: (block.getAttribute("data-wenyou-align") ?? "left") as ColorBlockSemantics["align"], content };
  });
}

const exported: { id: string; source: string; saved: string; expected: ColorBlockSemantics[] }[] = [];
afterEach(cleanup);
afterAll(async () => {
  if (process.env.WENYOU_TEXT_COLOR_ALIGNMENT_EXPORT) {
    writeFileSync(process.env.WENYOU_TEXT_COLOR_ALIGNMENT_EXPORT, JSON.stringify({
      version: 1,
      producerCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      sourceTreeClean: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() === "",
      sourceKind: "synthetic-web-regression",
      configuration: "production alignment parser/schema, color, boundary, attention, soft-break, atomic policy",
      cases: exported,
    }, null, 2));
  }
  // 等待 Milkdown 内部 timer 结束，防止 teardown 后的异步回调污染其他文件。
  await new Promise((resolve) => setTimeout(resolve, 3100));
});

test.each(colorAlignmentCases)("$id：输入、整段颜色、保存重开与阅读的独立语义", async (item) => {
  expect(findUnsupportedMarkdownFormats(item.source, textColorCapability)).toEqual([]);
  const root = document.createElement("div");
  document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(item.source) });
  crepe.editor.config(configureTextColorTestEditor)
    .use(editorTextColorSchema).use(editorBoundaryTextSchema).use(editorAttentionBoundaryParser)
    .use(editorSoftBreakParser).use(editorTextColorAtomicPolicy);
  try {
    await crepe.create();
    const saved = crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const initial = view.state.doc;
      expect(documentSemantics(initial)).toEqual(item.expected);
      if (item.wholeBlockColor) {
        const end = initial.firstChild!.nodeSize - 1;
        view.dispatch(view.state.tr.setSelection(TextSelection.create(initial, 1, end))
          .removeMark(1, end, view.state.schema.marks.wenyouTextColor!));
        expect(documentSemantics(view.state.doc)).toEqual(item.expected.map((block) => ({
          ...block, content: block.content.map((part) => ({ ...part, color: null })),
        })));
        view.dispatch(view.state.tr.addMark(1, end, view.state.schema.marks.wenyouTextColor!.create({ color: rgb })));
        expect(documentSemantics(view.state.doc)).toEqual(item.expected);
        expect(textColorSemanticJson(view.state.doc.toJSON())).toEqual(textColorSemanticJson(initial.toJSON()));
        expect(view.state.selection.from).toBe(1);
        expect(view.state.selection.to).toBe(end);
      }
      const value = serializeEditorMarkdown(ctx, view.state.doc, textColorCapability);
      const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(value))!;
      expect(documentSemantics(reopened)).toEqual(item.expected);
      expect(textColorSemanticJson(reopened.toJSON())).toEqual(textColorSemanticJson(initial.toJSON()));
      expect(serializeEditorMarkdown(ctx, reopened, textColorCapability)).toBe(value);
      return value;
    });
    for (const source of [item.source, saved]) {
      const reader = render(<MarkdownContent content={source} markdownContractVersion={6} />);
      expect(readerSemantics(reader.container)).toEqual(item.expected);
      reader.unmount();
    }
    exported.push({ id: item.id, source: item.source, saved, expected: item.expected });
  } finally {
    await crepe.destroy();
    root.remove();
  }
});

test("两空格硬换行仍受既有格式限制，与颜色无关", () => {
  const source = "[wenyousite-align-v1-right]: #\n" + colored("首行") + "  \n" + colored("次行");
  const issues = findUnsupportedMarkdownFormats(source, textColorCapability);
  expect(issues.map((issue) => issue.type)).toEqual(["hard-break"]);
  expect(findUnsupportedMarkdownFormats(
    source.replaceAll('<span data-wenyou-color-v1="' + rgb + '">', "").replaceAll("</span>", ""),
    textColorCapability,
  )).toEqual(issues);
});
