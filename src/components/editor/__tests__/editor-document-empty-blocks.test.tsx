import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx, parserCtx, serializerCtx } from "@milkdown/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { AllSelection, TextSelection } from "@milkdown/kit/prose/state";
import { cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, expect, test } from "vitest";
import rawFixture from "../../../../contracts/markdown-editor-list-v1-fixtures.json";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { hasVisibleMarkdownContent } from "@/lib/markdown";
import { createReaderClipboardPayload } from "@/lib/site-clipboard";
import { configureEditorAlignmentParser, configureEditorAlignmentSchemas } from "../editor-alignment";
import { withoutAutomaticTrailingParagraph } from "../editor-trailing-paragraph";
import { editorMarkdownPastePlugin } from "../markdown-literal-paste";
import { configureEditorMarkdownSerializer, createEditorMarkdownBridge, editorSoftBreakParser,
  prepareEditorMarkdown, serializeEditorMarkdown } from "../milkdown-markdown-codec";

type Block = { type: string; text?: string; start?: number; children?: Block[] };
type Case = { id: string; markdown: string; tree: Block[]; visible: boolean; operations: Array<{ path: number[]; text: string }> };
const fixture = rawFixture as typeof rawFixture & { documentCases: Case[] };

function editorTree(doc: ProseNode): Block[] {
  const visit = (node: ProseNode): Block => {
    const type = node.type.name === "heading" ? `heading-${node.attrs.level}` : node.type.name.replaceAll("_", "-");
    return { type, ...(node.isTextblock ? { text: node.textContent } : { children: Array.from({ length: node.childCount }, (_,i) => visit(node.child(i))) }),
      ...(type === "ordered-list" ? { start: Number(node.attrs.order) } : {}) };
  };
  const source = withoutAutomaticTrailingParagraph(doc);
  return Array.from({ length: source.childCount }, (_,i) => visit(source.child(i)));
}

function domTree(root: Element): Block[] {
  const visit = (element: Element): Block => {
    const type = ({ P: "paragraph", H2: "heading-2", H3: "heading-3", UL: "bullet-list", OL: "ordered-list", LI: "list-item", BLOCKQUOTE: "blockquote" } as Record<string,string>)[element.tagName];
    if (!type) throw new Error(`意外的块 ${element.outerHTML}`);
    if (["paragraph", "heading-2", "heading-3"].includes(type)) return { type, text: element.textContent ?? "" };
    const children = Array.from(element.children).filter(child => child.tagName !== "BR").map(visit);
    // 紧列表阅读 li 的直属文字没有 p 包裹，空 li 仍有一个可编辑文字块。
    if (type === "list-item" && (!children.length || Array.from(element.childNodes).some(node => node.nodeType === 3 && node.textContent))) {
      children.unshift({ type: "paragraph", text: Array.from(element.childNodes).filter(node => node.nodeType === 3).map(node => node.textContent).join("") });
    }
    if (type === "blockquote" && !children.length) children.push({ type: "paragraph", text: "" });
    return { type, children, ...(type === "ordered-list" ? { start: Number(element.getAttribute("start") ?? 1) } : {}) };
  };
  return Array.from(root.children).map(visit);
}

async function withEditor(source: string, run: (ctx: Ctx, emitted: string[], errors: unknown[]) => void) {
  const root = document.createElement("div"); document.body.append(root);
  const emitted: string[] = [], errors: unknown[] = [];
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(source) });
  crepe.editor.config(ctx => configureEditorAlignmentParser(ctx, { markdownContractVersion: 5 }))
    .config(ctx => configureEditorAlignmentSchemas(ctx, { markdownContractVersion: 5 }))
    .config(configureEditorMarkdownSerializer).use(editorSoftBreakParser).use(editorMarkdownPastePlugin)
    .use(createEditorMarkdownBridge({ onChange: value => emitted.push(value), onError: error => errors.push(error) }));
  try { await crepe.create(); crepe.editor.action(ctx => { const view = ctx.get(editorViewCtx); view.dispatch(view.state.tr); run(ctx, emitted, errors); }); }
  finally { await crepe.destroy(); root.remove(); }
}

function reader(markdown: string) {
  const result = render(<MarkdownContent content={markdown} />);
  const root = result.container.querySelector('[data-slot="markdown-content"]')!;
  return { tree: domTree(root), payload: createReaderClipboardPayload(root as HTMLElement), dispose: result.unmount };
}

afterEach(cleanup);
afterAll(async () => { await new Promise(resolve => setTimeout(resolve, 3100)); });

test.each(fixture.documentCases)("$id 独立文档树、编辑行、填字删空和保存重开", async item => {
  expect(hasVisibleMarkdownContent(item.markdown)).toBe(item.visible);
  const read = reader(item.markdown); expect(read.tree).toEqual(item.tree); read.dispose();
  await withEditor(item.markdown, (ctx, emitted, errors) => {
    const view = ctx.get(editorViewCtx);
    const expected = structuredClone(item.tree);
    const verify = () => {
      expect(editorTree(view.state.doc)).toEqual(expected);
      const saved = serializeEditorMarkdown(ctx, view.state.doc);
      const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(saved));
      expect(editorTree(reopened)).toEqual(expected);
      const result = reader(saved); expect(result.tree).toEqual(expected); result.dispose();
      expect(errors).toEqual([]);
      return saved;
    };
    verify();
    for (const operation of item.operations) {
      let node = view.state.doc, position = 0;
      let expectedNode: Block = { type: "doc", children: expected };
      for (const index of operation.path) {
        for (let sibling = 0; sibling < index; sibling++) position += node.child(sibling).nodeSize;
        node = node.child(index); position++;
        expectedNode = expectedNode.children![index]!;
      }
      expectedNode.text = operation.text;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position))
        .insertText(operation.text, position, position + node.content.size));
      expect(emitted.at(-1)).toBe(verify());
    }
    const saved = verify();
    // 阅读复制与编辑器复制分别进入实际 paste 事件，完整结构和空行均核对独立预期。
    const copied = view.someProp("clipboardSerializer")!.serializeFragment(view.state.doc.content);
    const holder = document.createElement("div"); holder.append(copied);
    const readSaved = reader(saved);
    for (const html of [holder.innerHTML, readSaved.payload.html]) {
      view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
      const event = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", { value: { files: [], getData: (type: string) => type === "text/html" ? html : "" } });
      view.dom.dispatchEvent(event);
      verify();
    }
    readSaved.dispose();
  });
});

test.each(fixture.cases.filter(item => item.items.every(node => node.empty)))("$id 只有空列表结构不可发布", item => {
  expect(hasVisibleMarkdownContent(item.markdown)).toBe(false);
  expect(hasVisibleMarkdownContent(item.canonical)).toBe(false);
});

test("列表子树相同但正文空行丢失时拒绝损坏同步", async () => {
  await withEditor("- 甲\n\n<br />\n<br />\n\n- 乙", ctx => {
    const doc = ctx.get(editorViewCtx).state.doc;
    ctx.set(serializerCtx, () => "- 甲\n\n<br />\n\n- 乙\n");
    expect(() => serializeEditorMarkdown(ctx, doc)).toThrow();
  });
});
