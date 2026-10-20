import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx, parserCtx } from "@milkdown/core";
import { TextSelection, NodeSelection, AllSelection } from "@milkdown/kit/prose/state";
import { splitBlock } from "@milkdown/kit/prose/commands";
import { undo, redo } from "@milkdown/kit/prose/history";
import { afterAll, expect, test } from "vitest";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Ctx } from "@milkdown/kit/ctx";
import { createReaderClipboardPayload } from "@/lib/site-clipboard";
import { editorMarkdownPastePlugin } from "../markdown-literal-paste";
import { editorTextFontSchema, editorTextFontAtomicPolicy } from "../editor-text-font";
import { applyEditorTextFont, editorTextFontTyping, getEditorTextFont } from "../editor-text-font-command";
import { editorBoundaryTextSchema, editorAttentionBoundaryParser, prepareEditorMarkdown, serializeEditorMarkdown } from "../milkdown-markdown-codec";
import { configureTextColorTestEditor, textColorSemanticJson } from "@/test/rich-text/text-color-editor";
afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3100)); });
async function withEditor(source: string, action: (view: EditorView, ctx: Ctx) => void) {
 const root = document.createElement("div"); document.body.append(root);
 const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(source) });
 crepe.editor.config(configureTextColorTestEditor).use(editorTextFontSchema).use(editorBoundaryTextSchema).use(editorAttentionBoundaryParser).use(editorTextFontAtomicPolicy).use(editorTextFontTyping).use(editorMarkdownPastePlugin);
 try { await crepe.create(); crepe.editor.action((ctx) => action(ctx.get(editorViewCtx), ctx)); }
 finally { await crepe.destroy(); root.remove(); }
}
test("光标选字体连续输入中文、emoji、组合字符，回车后延续，主动移动后结束", async () => withEditor("原文", (view) => {
 view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)));
 expect(applyEditorTextFont(view, "wenkai")).toBe(true);
 for (const text of ["中", "文", "😀", "á"]) view.dispatch(view.state.tr.insertText(text));
 splitBlock(view.state, view.dispatch);
 view.dispatch(view.state.tr.insertText("次行"));
 const colors: string[] = [];
 view.state.doc.descendants((node) => { if (node.isText && node.text !== "原文") colors.push(node.marks.find((m) => m.type.name === "wenyouTextFont")?.attrs.fontId); });
 expect(colors).toEqual(["wenkai", "wenkai"]);
 view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
 view.dispatch(view.state.tr.insertText("新"));
 expect(view.state.doc.firstChild!.firstChild!.marks).toEqual([]);
}));
test("整段跨段改字体保留对齐与组合，一次撤销重做；默认仅去字体", async () => withEditor("[wenyousite-align-v1-center]: #\n**甲😀**\n\n*乙*", (view, ctx) => {
 const original = view.state.doc;
 view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, view.state.doc.content.size - 1)));
 expect(applyEditorTextFont(view, "wenkai")).toBe(true);
 const colored = view.state.doc;
 expect(colored.firstChild!.attrs.textAlign).toBe("center");
 expect(colored.firstChild!.firstChild!.marks.map((m) => m.type.name)).toContain("strong");
 const saved = serializeEditorMarkdown(ctx, colored, { markdownContractVersion: 6, textFontVersion: 1 });
 expect(textColorSemanticJson(ctx.get(parserCtx)(prepareEditorMarkdown(saved))?.toJSON())).toEqual(textColorSemanticJson(colored.toJSON()));
 expect(undo(view.state, view.dispatch)).toBe(true); expect(view.state.doc.eq(original)).toBe(true);
 expect(redo(view.state, view.dispatch)).toBe(true); expect(view.state.doc.eq(colored)).toBe(true);
 applyEditorTextFont(view, null); expect(view.state.doc.eq(original)).toBe(true);
}));
test("混合字体不预选、非法值不修改、仅原子选区不可用", async () => withEditor('<span data-wenyou-font-v1="wenkai">甲</span>乙', (view) => {
 view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 3)));
 expect(getEditorTextFont(view.state)).toEqual({ enabled: true, fontId: undefined });
 const before = view.state.doc;
 expect(applyEditorTextFont(view, "rgb(0,0,0)")).toBe(false); expect(view.state.doc.eq(before)).toBe(true);
 const schema = view.state.schema;
 const image = schema.nodes.image!.create({ src: "https://example.com/test.png" });
 view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, schema.nodes.paragraph!.create(null, image)));
 view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 1)));
 expect(getEditorTextFont(view.state).enabled).toBe(false); expect(applyEditorTextFont(view, "wenkai")).toBe(false);
}));
test("代码块不允许字体；普通链接和行内代码可组合并往返", async () => withEditor("正文", (view, ctx) => {
 const s = view.state.schema;
 const doc = s.nodes.doc!.create(null, [
   s.nodes.code_block!.create(null, s.text("code")),
   s.nodes.paragraph!.create(null, s.text("链接代码", [s.marks.inlineCode!.create(), s.marks.link!.create({ href: "https://example.com" })])),
 ]);
 const replaced = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
 view.dispatch(replaced.setSelection(TextSelection.create(replaced.doc, 2)));
 expect(getEditorTextFont(view.state).enabled).toBe(false);
 expect(applyEditorTextFont(view, "wenkai")).toBe(false);
 view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, view.state.doc.content.size - 1)));
 applyEditorTextFont(view, "wenkai");
 expect(view.state.doc.firstChild!.firstChild!.marks).toEqual([]);
 const inlineDoc = s.nodes.doc!.create(null, view.state.doc.lastChild);
 const saved = serializeEditorMarkdown(ctx, inlineDoc, { markdownContractVersion: 6, textFontVersion: 1 });
 expect(textColorSemanticJson(ctx.get(parserCtx)(prepareEditorMarkdown(saved))?.toJSON())).toEqual(textColorSemanticJson(inlineDoc.toJSON()));
}));
test("整篇替换和撤销不泄漏显式输入字体", async () => withEditor("甲", (view) => {
 applyEditorTextFont(view, "wenkai");
 view.dispatch(view.state.tr.insertText("彩"));
 undo(view.state, view.dispatch);
 view.dispatch(view.state.tr.insertText("撤销后"));
 expect(view.state.doc.firstChild!.firstChild!.marks).toEqual([]);
 applyEditorTextFont(view, "wenkai");
 const s=view.state.schema; const doc=s.nodes.doc!.create(null,s.nodes.paragraph!.create(null,s.text("恢复")));
 const replaced = view.state.tr.replaceWith(0,view.state.doc.content.size,doc.content);
 view.dispatch(replaced.setSelection(TextSelection.create(replaced.doc,1)));
 view.dispatch(view.state.tr.insertText("新"));
 expect(view.state.doc.firstChild!.firstChild!.marks).toEqual([]);
}));

test("Ctrl+A AllSelection允许跨段改字体并跳过原子", async () => withEditor("甲\n\n乙", (view) => {
 view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
 expect(getEditorTextFont(view.state).enabled).toBe(true);
 expect(applyEditorTextFont(view, "wenkai")).toBe(true);
 expect(view.state.doc.firstChild!.firstChild!.marks[0]?.attrs.fontId).toBe("wenkai");
 expect(view.state.doc.lastChild!.firstChild!.marks[0]?.attrs.fontId).toBe("wenkai");
}));

test("仅光标选择或清除输入字体不产生正文事务和草稿脏状态", async () => withEditor("原稿", (view) => {
 const before = view.state.doc;
 const dispatch = view.dispatch.bind(view);
 const docChanges: boolean[] = [];
 view.dispatch = (transaction) => { docChanges.push(transaction.docChanged); dispatch(transaction); };
 applyEditorTextFont(view, "wenkai");
 applyEditorTextFont(view, null);
 expect(docChanges).toEqual([false, false]);
 expect(view.state.doc.eq(before)).toBe(true);
}));

test("输入法组合替换保留显式字体和其他 marks", async () => withEditor("原", (view) => {
 const strong = view.state.schema.marks.strong!.create();
 view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)).setStoredMarks([strong]));
 applyEditorTextFont(view, "wenkai");
 view.dispatch(view.state.tr.insertText("n").setMeta("composition", 1));
 view.dispatch(view.state.tr.insertText("你", 2, 3).setMeta("composition", 1));
 view.dispatch(view.state.tr.insertText("好").setMeta("composition", 2));
 const text = view.state.doc.firstChild!.lastChild!;
 expect(text.text).toBe("你好");
 expect(text.marks.map((mark) => mark.type.name)).toEqual(expect.arrayContaining(["strong", "wenyouTextFont"]));
 expect(text.marks.find((mark) => mark.type.name === "wenyouTextFont")?.attrs.fontId).toBe("wenkai");
}));

test("富文粘贴保源字体、原子无字体，随后手输仍用显式字体", async () => withEditor("原", (view) => {
 view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
 applyEditorTextFont(view, "wenkai");
 const reader = document.createElement("div");
 reader.innerHTML = '<p><span data-wenyou-font-v1="zhuque"><strong>粘贴</strong></span></p>';
 const copied = createReaderClipboardPayload(reader);
 const event = new Event("paste", { cancelable: true }) as ClipboardEvent;
 Object.defineProperty(event, "clipboardData", { value: { files: [], types: ["text/html", "text/plain"],
  getData: (type: string) => type === "text/html" ? copied.html : type === "text/plain" ? copied.text : "" } });
 expect(view.someProp("handleDOMEvents", (events) => events.paste?.(view, event))).toBe(true);
 view.dispatch(view.state.tr.insertText("续"));
 const image = view.state.schema.nodes.image!.create({ src: "https://example.com/image.png" });
 const insert = view.state.tr.replaceSelectionWith(image);
 insert.setSelection(TextSelection.near(insert.doc.resolve(insert.selection.to)));
 view.dispatch(insert);
 view.dispatch(view.state.tr.insertText("图后"));
 const segments: [string, string | null][] = [];
 view.state.doc.descendants((node) => {
  if (node.isText) segments.push([node.text!, node.marks.find((mark) => mark.type.name === "wenyouTextFont")?.attrs.fontId ?? null]);
  if (node.type.name === "image") expect(node.marks.some((mark) => mark.type.name === "wenyouTextFont")).toBe(false);
 });
 expect(segments).toEqual([["原", null], ["粘贴", "zhuque"], ["续", "wenkai"], ["图后", "wenkai"]]);
}));
