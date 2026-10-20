import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx, parserCtx } from "@milkdown/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { undo, redo } from "@milkdown/kit/prose/history";
import { splitBlock } from "@milkdown/kit/prose/commands";
import { afterAll, expect, test } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { writeFileSync } from "node:fs";
import fixtures from "../../../../contracts/markdown-text-font-v1-fixtures.json";
import { editorTextFontSchema, editorTextFontAtomicPolicy } from "../editor-text-font";
import { editorTextColorSchema, editorTextColorAtomicPolicy } from "../editor-text-color";
import { applyEditorTextFont, editorTextFontTyping } from "../editor-text-font-command";
import { applyEditorTextColor, editorTextColorTyping } from "../editor-text-color-command";
import { editorBoundaryTextSchema, editorAttentionBoundaryParser, prepareEditorMarkdown, serializeEditorMarkdown } from "../milkdown-markdown-codec";
import { configureTextColorTestEditor, textColorSemanticJson as semantic } from "@/test/rich-text/text-color-editor";
import { findUnsupportedMarkdownFormats } from "@/lib/markdown";
import { assessEditorInput } from "@/lib/editor-content-compatibility";
import { formatMarkdownPreview } from "@/lib/markdown-preview";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { createReaderClipboardPayload } from "@/lib/site-clipboard";
import { editorMarkdownPastePlugin } from "../markdown-literal-paste";
const capability = { markdownContractVersion: 6, textColorVersion: 1, textFontVersion: 1 } as const;
const exported: { source: string; saved: string }[] = [];
afterAll(async () => { if (process.env.WENYOU_TEXT_FONT_EXPORT) writeFileSync(process.env.WENYOU_TEXT_FONT_EXPORT, JSON.stringify(exported, null, 2)); await new Promise((r) => setTimeout(r, 3100)); });
async function withEditor(source: string, run: Parameters<CrepeBuilder["editor"]["action"]>[0]) {
 const root = document.createElement("div"); document.body.append(root);
 const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(source) });
 crepe.editor.config(configureTextColorTestEditor).use(editorTextFontSchema).use(editorTextColorSchema).use(editorBoundaryTextSchema).use(editorAttentionBoundaryParser).use(editorTextFontAtomicPolicy).use(editorTextColorAtomicPolicy).use(editorTextFontTyping).use(editorTextColorTyping).use(editorMarkdownPastePlugin);
 try { await crepe.create(); crepe.editor.action(run); } finally { await crepe.destroy(); root.remove(); }
}
for (const item of fixtures.validCases) for (const projection of ["source", "fontOnly", "colorOnly", "legacy"] as const) {
 test(`${item.id} ${projection}：实际Milkdown保存重开保留字符与全部marks`, async () => {
  const source = item[projection];
  expect(findUnsupportedMarkdownFormats(source)).toEqual([]);
  await withEditor(source, (ctx) => {
   const initial = ctx.get(editorViewCtx).state.doc;
   const saved = serializeEditorMarkdown(ctx, initial, capability);
   exported.push({ source, saved });
   const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(saved));
   expect(semantic(reopened?.toJSON())).toEqual(semantic(initial.toJSON()));
   expect(serializeEditorMarkdown(ctx, reopened!, capability)).toBe(saved);
   if (projection === "source" || projection === "fontOnly") expect(saved).toContain('data-wenyou-font-v1="wenkai"');
  });
 });
}
test.each(fixtures.invalidSources)("非法字体源码不能激活：%s", (source) => {
 expect(findUnsupportedMarkdownFormats(source).length).toBeGreaterThan(0);
 expect(assessEditorInput(source, 6, true, true).edit).toBe(false);
});
test("字体和颜色独立能力保护；纯文字和摘要不暴露标记", () => {
 const source = fixtures.validCases[1]!.source;
 for (const [color, font] of [[false,false],[true,false],[false,true],[true,true]]) expect(assessEditorInput(source, 6, color, font).edit).toBe(color && font);
 expect(formatMarkdownPreview(source)).toBe("中英 Hello 123");
});
test("字体+颜色+32种格式组合、Unicode与边缘空白保存稳定", async () => withEditor("", (ctx) => {
 const schema=ctx.get(editorViewCtx).state.schema;
 const names=["strong","emphasis","strike_through","inlineCode","link"];
 for(let bits=0;bits<32;bits++) for(const text of ["中文😀", "é", "x`y", "   ", " 字面 "]) {
  const marks=names.filter((_,i)=>bits & (1<<i)).map(name=>schema.marks[name]!.create(name==="link"?{href:"https://example.com",title:"链接"}:undefined));
  marks.push(schema.marks.wenyouTextFont!.create({fontId:"wenkai"}),schema.marks.wenyouTextColor!.create({color:"#D14343"}));
  const doc=schema.nodes.doc!.create(null,schema.nodes.paragraph!.create(null,schema.text(text,marks)));
  const saved=serializeEditorMarkdown(ctx,doc,capability);
  expect(saved).toContain('data-wenyou-font-v1="wenkai" data-wenyou-color-v1="#D14343"');
  const reopened=ctx.get(parserCtx)(prepareEditorMarkdown(saved));
  // 非代码边缘空白只保留样式共同范围；保存边界沿既有通用规范化。
  expect(reopened?.textContent).toBe(text);
  expect(serializeEditorMarkdown(ctx,reopened!,capability)).toBe(saved);
 }
}));
test("跨段选区、仅清字体、撤销重做及双样式持续输入", async () => withEditor("**甲**\n\n*乙*", (ctx) => {
 const view=ctx.get(editorViewCtx);
 view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,1,view.state.doc.content.size-1)));
 applyEditorTextColor(view,"#D14343");
 const before=view.state.doc;
 expect(applyEditorTextFont(view,"wenkai")).toBe(true);
 const both=view.state.doc;
 expect(undo(view.state,view.dispatch)).toBe(true); expect(view.state.doc.eq(before)).toBe(true);
 expect(redo(view.state,view.dispatch)).toBe(true); expect(view.state.doc.eq(both)).toBe(true);
 applyEditorTextFont(view,null); expect(view.state.doc.eq(before)).toBe(true);
 view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,view.state.doc.content.size-1)));
 applyEditorTextFont(view,"wenkai"); applyEditorTextColor(view,"#2563EB");
 view.dispatch(view.state.tr.insertText("中文😀é")); splitBlock(view.state,view.dispatch); view.dispatch(view.state.tr.insertText("续写"));
 expect(view.state.doc.lastChild!.firstChild!.marks.map(mark=>mark.type.name)).toEqual(expect.arrayContaining(["wenyouTextFont","wenyouTextColor"]));
 expect(()=>serializeEditorMarkdown(ctx,view.state.doc,{markdownContractVersion:6,textColorVersion:1})).toThrow("正文已保留");
 expect(serializeEditorMarkdown(ctx,view.state.doc,capability)).toContain('data-wenyou-font-v1="wenkai" data-wenyou-color-v1="#2563EB"');
}));
test("阅读复制v2与编辑粘贴同时保留两个属性，外部CSS不激活", async () => {
 const {container}=render(<MarkdownContent content={fixtures.validCases[3]!.source}/>);
 const span=container.querySelector('[data-wenyou-font-v1="wenkai"]')!;
 expect(span).toHaveAttribute("data-wenyou-color-v1","#D14343");
 const external=document.createElement("div"); external.innerHTML='<p style="font-family:wenkai">外部字体</p>';
 expect(createReaderClipboardPayload(external).html).not.toContain("data-wenyou-font-v1");
 const copied=createReaderClipboardPayload(container);
 expect(copied.html).toContain('data-wenyou-font-v1="wenkai"'); expect(copied.html).toContain('data-wenyou-color-v1="#D14343"');
 cleanup();
 await withEditor("", ctx=>{
  const view=ctx.get(editorViewCtx);
  const event=new Event("paste",{cancelable:true}) as ClipboardEvent;
  Object.defineProperty(event,"clipboardData",{value:{files:[],types:["text/html","text/plain"],getData:(type:string)=>type==="text/html"?copied.html:type==="text/plain"?copied.text:""}});
  expect(view.someProp("handleDOMEvents",events=>events.paste?.(view,event))).toBe(true);
  const saved=serializeEditorMarkdown(ctx,view.state.doc,capability);
  expect(saved).toContain('data-wenyou-font-v1="wenkai" data-wenyou-color-v1="#D14343"');
  expect(saved).toContain("**粗体 Bold**");
 });
});
