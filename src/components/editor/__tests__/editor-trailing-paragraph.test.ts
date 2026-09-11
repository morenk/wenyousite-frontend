import { CrepeBuilder } from "@milkdown/crepe/builder";
import { imageBlock } from "@milkdown/crepe/feature/image-block";
import { editorViewCtx, parserCtx } from "@milkdown/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { closeHistory, redo, undo } from "@milkdown/kit/prose/history";
import { AllSelection, TextSelection } from "@milkdown/kit/prose/state";
import { afterAll, expect, test, vi } from "vitest";
import { configureEditorAlignmentParser, configureEditorAlignmentSchemas } from "../editor-alignment";
import { AUTO_TRAILING_PARAGRAPH } from "../editor-trailing-paragraph";
import { editorMarkdownPastePlugin } from "../markdown-literal-paste";
import { configureEditorMarkdownSerializer, createEditorMarkdownBridge, editorSoftBreakParser,
  prepareEditorMarkdown, serializeEditorMarkdown } from "../milkdown-markdown-codec";

async function withEditor(source: string, run: (ctx: Ctx) => void, callbacks: { onError?: (error: unknown) => void; onSyncErrorChange?: (hasError: boolean) => void } = {}) {
  const root = document.createElement("div");
  document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(source) });
  crepe.addFeature(imageBlock);
  crepe.editor.config((ctx) => configureEditorAlignmentParser(ctx, { markdownContractVersion: 5 }))
    .config((ctx) => configureEditorAlignmentSchemas(ctx, { markdownContractVersion: 5 }))
    .config(configureEditorMarkdownSerializer).use(editorSoftBreakParser).use(editorMarkdownPastePlugin)
    .use(createEditorMarkdownBridge({ onChange: () => {}, onError: (error) => { throw error; }, ...callbacks }));
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr);
      run(ctx);
    });
  } finally { await crepe.destroy(); root.remove(); }
}

afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3_100)); });
const blocks = ["---", "![图片](https://cdn.example.com/boundary.png)", "- 末尾列表", "> 末尾引用"];

test.each(blocks)("%s 自动尾段不写入，输入清空及撤销重做保留来源", async (block) => {
  await withEditor(`前文\n\n${block}`, (ctx) => {
    const view = ctx.get(editorViewCtx);
    const serialize = () => serializeEditorMarkdown(ctx, view.state.doc);
    const original = serialize();
    expect(original).not.toContain("<br />");
    expect(view.state.doc.lastChild!.attrs[AUTO_TRAILING_PARAGRAPH]).toBe(true);
    expect(view.dom.lastElementChild?.tagName).toBe("P");
    expect(view.dom.innerHTML).not.toContain(AUTO_TRAILING_PARAGRAPH);
    const copied = view.someProp("clipboardSerializer")!.serializeFragment(view.state.doc.content);
    expect(Array.from(copied.querySelectorAll("p")).filter((p) => !p.textContent)).toHaveLength(0);

    // 无关正文编辑与原样重开都不会将自动占位变成作者空段。
    view.dispatch(closeHistory(view.state.tr).insertText("改", 1));
    expect(serialize()).not.toContain("<br />");
    expect(undo(view.state, view.dispatch)).toBe(true);
    expect(serialize()).toBe(original);
    const position = view.state.doc.content.size - 1;
    view.dispatch(closeHistory(view.state.tr).insertText("文字", position));
    expect(view.state.doc.lastChild!.attrs[AUTO_TRAILING_PARAGRAPH]).toBe(false);
    expect(serialize()).toBe(`${original}\n\n文字`);
    view.dispatch(closeHistory(view.state.tr).delete(position, position + 2));
    const authored = `${original}\n\n<br />`;
    expect(serialize()).toBe(authored);
    expect(undo(view.state, view.dispatch)).toBe(true);
    expect(serialize()).toBe(`${original}\n\n文字`);
    expect(undo(view.state, view.dispatch)).toBe(true);
    expect(serialize()).toBe(original);
    expect(view.state.doc.lastChild!.attrs[AUTO_TRAILING_PARAGRAPH]).toBe(true);
    expect(redo(view.state, view.dispatch)).toBe(true);
    expect(serialize()).toBe(`${original}\n\n文字`);
    expect(redo(view.state, view.dispatch)).toBe(true);
    expect(serialize()).toBe(authored);
    const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(authored));
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, reopened.content));
    expect(serialize()).toBe(authored);
    expect(view.state.doc.lastChild!.attrs[AUTO_TRAILING_PARAGRAPH]).toBe(false);
  });
});

test.each(blocks)("%s 自动尾段中 Enter 形成作者空段，保存重开与历史空段一致", async (block) => {
  await withEditor(`前文\n\n${block}`, (ctx) => {
    const view = ctx.get(editorViewCtx);
    const original = serializeEditorMarkdown(ctx, view.state.doc);
    view.dispatch(closeHistory(view.state.tr).setSelection(TextSelection.create(view.state.doc, view.state.doc.content.size - 1)));
    expect(view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })))).toBe(true);
    const authored = `${original}\n\n<br />\n<br />`;
    expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(authored);
    expect(undo(view.state, view.dispatch)).toBe(true);
    expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(original);
    expect(redo(view.state, view.dispatch)).toBe(true);
    expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(authored);
    const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(authored));
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, reopened.content));
    expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(authored);
    expect(view.state.doc.lastChild!.attrs[AUTO_TRAILING_PARAGRAPH]).toBe(false);
  });
});

test.each(blocks)("%s 后连续 Enter 再输入，空段与正文均可保存重开", async (block) => {
  await withEditor(`前文\n\n${block}`, (ctx) => {
    const view = ctx.get(editorViewCtx);
    const original = serializeEditorMarkdown(ctx, view.state.doc);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, view.state.doc.content.size - 1)));
    for (let index = 0; index < 2; index++) {
      expect(view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })))).toBe(true);
    }
    view.dispatch(view.state.tr.insertText("继续输入正文"));
    const stored = serializeEditorMarkdown(ctx, view.state.doc);
    expect(stored).toBe(`${original}${block.startsWith("![") ? "\n" : "\n\n"}<br />\n<br />\n继续输入正文`);
    const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(stored));
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, reopened.content));
    expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(stored);
    expect(view.state.doc.lastChild!.textContent).toBe("继续输入正文");
  });
});

test("伪造来源属性的站内 HTML 不会将作者空段当成自动占位", async () => {
  await withEditor("初始", (ctx) => {
    const view = ctx.get(editorViewCtx);
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
    const html = '<div data-wenyou-clipboard="2" data-wenyou-clipboard-source="editor">'
      + '<p wenyouAutoTrailing="true" data-wenyou-editor-placeholder="true"><br></p>'
      + '<p>作者</p><p wenyouAutoTrailing="true"><br></p></div>';
    const paste = (source: string) => {
      view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
      const event = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", { value: { files: [], getData: (type: string) => type === "text/html" ? source : "作者" } });
      view.dom.dispatchEvent(event);
    };
    paste(html.replace(/ (?:wenyouAutoTrailing|data-wenyou-editor-placeholder)="true"/gu, ""));
    const control = view.state.doc.toJSON();
    const controlMarkdown = serializeEditorMarkdown(ctx, view.state.doc);
    paste(html);
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(1).textContent).toBe("作者");
    view.state.doc.forEach((node) => expect(node.attrs[AUTO_TRAILING_PARAGRAPH]).toBe(false));
    expect(view.state.doc.toJSON()).toEqual(control);
    expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(controlMarkdown);
    expect(view.dom.innerHTML).not.toContain(AUTO_TRAILING_PARAGRAPH);
  });
});

test("序列化失败报告不可保存，撤销回相同旧正文也清除错误", async () => {
  const onError = vi.fn();
  const onSyncErrorChange = vi.fn();
  await withEditor("正文", (ctx) => {
    const view = ctx.get(editorViewCtx);
    const invalid = ctx.get(parserCtx)("# 协议外一级标题");
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, invalid.content));
    expect(onError).toHaveBeenCalled();
    expect(onSyncErrorChange).toHaveBeenLastCalledWith(true);
    expect(undo(view.state, view.dispatch)).toBe(true);
    expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe("正文");
    expect(onSyncErrorChange).toHaveBeenLastCalledWith(false);
  }, { onError, onSyncErrorChange });
});
