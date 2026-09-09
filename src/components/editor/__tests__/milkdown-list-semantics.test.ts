import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CrepeBuilder } from "@milkdown/crepe/builder";
import { imageBlock } from "@milkdown/crepe/feature/image-block";
import { editorViewCtx, parserCtx, serializerCtx } from "@milkdown/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { afterAll, expect, test } from "vitest";
import {
  configureEditorMarkdownSerializer,
  editorAttentionBoundaryParser,
  editorSoftBreakParser,
  prepareEditorMarkdown,
  serializeEditorMarkdown,
} from "@/components/editor/milkdown-markdown-codec";
import {
  configureEditorAlignmentParser,
  configureEditorAlignmentSchemas,
} from "@/components/editor/editor-alignment";
import { findUnsupportedMarkdownFormats } from "@/lib/markdown";

type Item = { type: string; depth: number; parent: number | null; start: number | null; text: string; empty: boolean; blocks: Array<{type:string;lines:string[]}> };
const fixture = JSON.parse(readFileSync(resolve(process.cwd(), "contracts/markdown-editor-list-v1-fixtures.json"), "utf8")) as { cases: Array<{id:string;markdown:string;canonical:string;items:Item[];editableLines:string[];inline?:Array<{text:string;href:string}>}>;editCases:Array<{id:string;markdown:string;canonical:string;expectedCase:string;operation:{type:string;item:number;offset:number;length?:number;text?:string}}> };

function itemsIn(doc: ProseNode): Item[] {
 const items: Item[] = [];
 function visit(node: ProseNode, depth: number, parent: number | null) {
  if (node.type.name === "bullet_list" || node.type.name === "ordered_list") {
   node.forEach(li => {
    const index = items.length;
    const blocks: Item["blocks"] = [];
    li.forEach((block, _offset, childIndex) => {
     if (block.isTextblock) {
      if (childIndex === 0 && !block.content.size && li.childCount > 1 && li.child(1).type.name === "heading") return;
      let text = "";
      block.forEach(child => {text += child.type.name === "hardbreak" ? "\n" : child.textContent;});
      blocks.push({type:block.type.name === "heading" ? `heading-${block.attrs.level}` : block.type.name, lines:text.split("\n")});
     }
    });
    const text = blocks.flatMap(b => b.lines).join("\n");
    items.push({type:node.type.name === "ordered_list" ? "ordered" : "bullet", depth, parent, start:node.type.name === "ordered_list" ? Number(node.attrs.order) : null, text, empty:text === "", blocks});
    li.forEach(child => { if (!child.isTextblock) visit(child,depth+1,index); });
   });
  } else node.forEach(child => visit(child,depth,parent));
 }
 visit(doc,0,null);
 return items;
}

function anchorIn(doc: ProseNode, anchor: string) {
  const matches: Array<{ node: ProseNode; position: number }> = [];
  doc.descendants((node, position) => {
    if (node.isText && node.text?.includes(anchor)) {
      matches.push({ node, position: position + node.text.indexOf(anchor) });
    }
  });
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

async function withEditor(markdown: string, run: (crepe: CrepeBuilder, emitted: string[]) => void) {
  const root = document.createElement("div");
  document.body.append(root);
  const emitted: string[] = [];
  const crepe = new CrepeBuilder({
    root,
    defaultValue: prepareEditorMarkdown(markdown + "\n\n尾段", { markdownContractVersion: 5 }),
  });
  crepe.addFeature(imageBlock);
  crepe.editor
    .config((ctx) => configureEditorAlignmentParser(ctx, { markdownContractVersion: 5 }))
    .config((ctx) => configureEditorAlignmentSchemas(ctx, { markdownContractVersion: 5 }))
    .config(configureEditorMarkdownSerializer)
    .use(editorAttentionBoundaryParser)
    .use(editorSoftBreakParser)
;
  try {
    await crepe.create();
    run(crepe, emitted);
  } finally {
    await crepe.destroy();
    root.remove();
  }
}

afterAll(async () => {
  // Milkdown ctx 在销毁后仍会完成内部定时器。
  await new Promise((resolve) => setTimeout(resolve, 3_100));
});



test.each(fixture.cases)("$id 编辑/保存/重开保留独立列表树", async item => {
 await withEditor(item.markdown, crepe => crepe.editor.action(ctx => {
  const view = ctx.get(editorViewCtx);
  expect(itemsIn(view.state.doc)).toEqual(item.items);
  for (const inline of item.inline ?? []) {
    let found = false;
    view.state.doc.descendants(node => {
      if (node.text !== inline.text) return;
      expect(node.marks.find(mark => mark.type.name === "link")?.attrs.href).toBe(inline.href);
      expect(node.marks.some(mark => mark.type.name === "strong")).toBe(true);
      found = true;
    });
    expect(found).toBe(true);
  }
  const value = serializeEditorMarkdown(ctx,view.state.doc);
  expect(findUnsupportedMarkdownFormats(value)).toEqual([]);
  const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(value));
  expect(itemsIn(reopened)).toEqual(item.items);
  expect(serializeEditorMarkdown(ctx,reopened)).toBe(value);
  expect(itemsIn(ctx.get(parserCtx)(prepareEditorMarkdown(item.canonical)))).toEqual(item.items);
  // 在实际段落输入再删除；空项必须仍可编辑，不能只保留不可选中的列表外壳。
  let position = 0;
  view.state.doc.descendants((node,pos) => {if (!position && node.type.name === "paragraph") position=pos+1;});
  if (item.id === "setext-is-heading") position = anchorIn(view.state.doc,"甲").position;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,position)).insertText("新"));
  const changed = serializeEditorMarkdown(ctx,view.state.doc);
  expect(itemsIn(ctx.get(parserCtx)(prepareEditorMarkdown(changed)))).toEqual(itemsIn(view.state.doc));
  view.dispatch(view.state.tr.delete(position,position+1));
  expect(itemsIn(view.state.doc)).toEqual(item.items);
  expect(serializeEditorMarkdown(ctx,view.state.doc)).toBe(value);
 }));
});

test.each(["- 甲\n  - 乙\n    - 丙","1. 甲\n   1. 乙\n      1. 丙","- 甲\n  1. 乙\n     - 丙"])("%s 删除末项正文保留空项与父子关系", async source => {
 await withEditor(source, crepe => crepe.editor.action(ctx => {
  const view = ctx.get(editorViewCtx);
  const before = itemsIn(view.state.doc);
  const {position} = anchorIn(view.state.doc,"丙");
  view.dispatch(view.state.tr.delete(position,position+1));
  const expected = before.map((item,index) => index === 2 ? {...item,text:"",empty:true,blocks:[{type:"paragraph",lines:[""]}]} : item);
  const saved = serializeEditorMarkdown(ctx,view.state.doc);
  expect(itemsIn(ctx.get(parserCtx)(prepareEditorMarkdown(saved)))).toEqual(expected);
 }));
});

test("纯空格与 Tab 不会冒充零长度空项并被静默丢弃", async () => {
 await withEditor("- 甲", crepe => crepe.editor.action(ctx => {
  const view = ctx.get(editorViewCtx);
  const {position} = anchorIn(view.state.doc,"甲");
  for (const text of [" ","  ","\t"]) {
   const doc = view.state.tr.insertText(text,position,position+1).doc;
   const saved = serializeEditorMarkdown(ctx,doc);
   const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(saved));
   expect(itemsIn(reopened)[0]!.text).toBe(text);
   expect(itemsIn(reopened)[0]!.empty).toBe(false);
  }
 }));
});


test.each(fixture.editCases)("$id 执行共享编辑操作并核对独立预期", async item => {
 await withEditor(item.markdown, crepe => crepe.editor.action(ctx => {
  const view = ctx.get(editorViewCtx);
  const positions: number[] = [];
  view.state.doc.descendants((node,pos) => {if (node.type.name === "list_item") positions.push(pos+2);});
  const position = positions[item.operation.item]! + item.operation.offset;
  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc,position));
  view.dispatch(item.operation.type === "deleteText" ? tr.delete(position,position+item.operation.length!) : tr.insertText(item.operation.text!));
  const expected = fixture.cases.find(c=>c.id === item.expectedCase)!.items;
  expect(itemsIn(view.state.doc)).toEqual(expected);
  const saved = serializeEditorMarkdown(ctx,view.state.doc);
  expect(itemsIn(ctx.get(parserCtx)(prepareEditorMarkdown(saved)))).toEqual(expected);
  expect(itemsIn(ctx.get(parserCtx)(prepareEditorMarkdown(item.canonical)))).toEqual(expected);
 }));
});

test("切换根列表类型保留三层父子、空项与正文", async () => {
 await withEditor("- 甲\n  - 乙\n\n    -", crepe => crepe.editor.action(ctx => {
  const view=ctx.get(editorViewCtx);
  const before=itemsIn(view.state.doc);
  for(const type of ["ordered_list","bullet_list"]) {
   const attrs = view.state.doc.firstChild!.firstChild!.attrs;
   view.dispatch(view.state.tr.setNodeMarkup(0,view.state.schema.nodes[type],type === "ordered_list" ? {order:1} : {})
     .setNodeMarkup(1,undefined,{...attrs,listType:type === "ordered_list" ? "ordered" : "bullet",label:type === "ordered_list" ? "1." : "•"}));
   const expected=before.map((item,index)=>index===0?{...item,type:type==="ordered_list"?"ordered":"bullet",start:type==="ordered_list"?1:null}:item);
   const saved=serializeEditorMarkdown(ctx,view.state.doc);
   expect(itemsIn(ctx.get(parserCtx)(prepareEditorMarkdown(saved)))).toEqual(expected);
  }
 }));
});


test("项数相同但父子改变时拒绝损坏保存", async () => {
 await withEditor("- 甲\n  - 乙", crepe => crepe.editor.action(ctx => {
  const doc=ctx.get(editorViewCtx).state.doc;
  ctx.set(serializerCtx,()=>"- 甲\n- 乙\n\n尾段\n");
  expect(()=>serializeEditorMarkdown(ctx,doc)).toThrow("列表保存未能保留完整结构");
 }));
});
