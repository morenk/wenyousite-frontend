import { readFileSync, writeFileSync } from "node:fs";
import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx, parserCtx, serializerCtx } from "@milkdown/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { undo, redo, closeHistory } from "@milkdown/kit/prose/history";
import { createReaderClipboardPayload } from "@/lib/site-clipboard";
import { editorMarkdownPastePlugin } from "../markdown-literal-paste";
import { afterAll, expect, test } from "vitest";
import fixtures from "../../../../contracts/markdown-text-color-v1-fixtures.json";
import { createDiceInlineEditorPlugins } from "../dice-inline-plugin";
import { editorTextColorSchema, editorTextColorAtomicPolicy } from "../editor-text-color";
import { editorSoftBreakParser, editorBoundaryTextSchema, editorAttentionBoundaryParser, prepareEditorMarkdown, serializeEditorMarkdown } from "../milkdown-markdown-codec";

import { configureTextColorTestEditor, textColorSemanticJson as semanticJson } from "@/test/rich-text/text-color-editor";
const exported: { source: string; saved: string }[] = [];
afterAll(async () => { if (process.env.WENYOU_TEXT_COLOR_EXPORT) writeFileSync(process.env.WENYOU_TEXT_COLOR_EXPORT, JSON.stringify(exported, null, 2)); await new Promise((resolve) => setTimeout(resolve, 3100)); });
test.each(fixtures.validCases)("实际 Milkdown 颜色契约 $id 保存重开不丢失", async ({ source }) => {
  const root = document.createElement("div"); document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(source) });
  crepe.editor.config(configureTextColorTestEditor).use(editorTextColorSchema).use(editorBoundaryTextSchema).use(editorAttentionBoundaryParser);
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const initial = view.state.doc;
      const saved = serializeEditorMarkdown(ctx, initial, { markdownContractVersion: 6, textColorVersion: 1 });
      exported.push({ source, saved });
      const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(saved));
      expect(reopened?.toJSON()).toEqual(initial.toJSON());
      expect(serializeEditorMarkdown(ctx, reopened!, { markdownContractVersion: 6, textColorVersion: 1 })).toBe(saved);
    });
  } finally { await crepe.destroy(); root.remove(); }
});

test("颜色范围与粗体交叉时外置颜色并保留继续的格式", async () => {
  const root = document.createElement("div"); document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: "**左中右**" });
  crepe.editor.config(configureTextColorTestEditor).use(editorTextColorSchema).use(editorBoundaryTextSchema).use(editorAttentionBoundaryParser);
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.addMark(2, 3, view.state.schema.marks.wenyouTextColor!.create({ color: "#D14343" })));
      const saved = serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 6, textColorVersion: 1 });
      expect(saved).toBe('**左**<span data-wenyou-color-v1="#D14343">**中**</span>**右**');
      expect(ctx.get(parserCtx)(prepareEditorMarkdown(saved))?.toJSON()).toEqual(view.state.doc.toJSON());
    });
  } finally { await crepe.destroy(); root.remove(); }
});

test("全部32种共同格式、emoji和组合字符与RGB按字符保存，颜色进入失败保护", async () => {
  const root = document.createElement("div"); document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: "" });
  crepe.editor.config(configureTextColorTestEditor).use(editorTextColorSchema).use(editorBoundaryTextSchema).use(editorAttentionBoundaryParser);
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx), schema = view.state.schema;
      const names = ["strong", "emphasis", "strike_through", "inlineCode", "link"];
      for (let bits = 0; bits < 32; bits++) {
        const marks = names.filter((_, index) => bits & (1 << index)).map((name) => schema.marks[name]!.create(name === "link" ? { href: "https://example.com/test", title: "普通链接" } : undefined));
        marks.push(schema.marks.wenyouTextColor!.create({ color: "#000000" }));
        for (const text of ["中文😀", "a\u0301", "A&B", "*字面*", "<tag>", "x`y"]) {
          const doc = schema.nodes.doc!.create(null, schema.nodes.paragraph!.create(null, schema.text(text, marks)));
          const saved = serializeEditorMarkdown(ctx, doc, { markdownContractVersion: 6, textColorVersion: 1 });
          expect(semanticJson(ctx.get(parserCtx)(prepareEditorMarkdown(saved))?.toJSON()), saved).toEqual(semanticJson(doc.toJSON()));
          expect(() => serializeEditorMarkdown(ctx, doc, { markdownContractVersion: 6 })).toThrow("正文已保留");
        }
      }
      for (const text of [" x ", "   ", "\u00a0", "😀"]) {
        const doc = schema.nodes.doc!.create(null, schema.nodes.paragraph!.create(null,
          schema.text(text, [schema.marks.wenyouTextColor!.create({ color: "#FFFFFF" })])));
        const saved = serializeEditorMarkdown(ctx, doc, { markdownContractVersion: 6, textColorVersion: 1 });
        expect(ctx.get(parserCtx)(prepareEditorMarkdown(saved))?.toJSON()).toEqual(doc.toJSON());
      }
    });
  } finally { await crepe.destroy(); root.remove(); }
});

test("阅读复制、编辑粘贴、只移除颜色及单步撤销重做保留其他格式", async () => {
  const root = document.createElement("div"); document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: "" });
  crepe.editor.config(configureTextColorTestEditor).use(editorTextColorSchema).use(editorBoundaryTextSchema).use(editorAttentionBoundaryParser).use(editorMarkdownPastePlugin);
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const reader = document.createElement("div");
      reader.innerHTML = '<p><span data-wenyou-color-v1="#D14343"><strong>中文😀</strong> <code>代码</code></span></p>';
      const copied = createReaderClipboardPayload(reader);
      const event = new Event("paste", { cancelable: true }) as ClipboardEvent;
      Object.defineProperty(event, "clipboardData", { value: { files: [], types: ["text/html", "text/plain"],
        getData: (type: string) => type === "text/html" ? copied.html : type === "text/plain" ? copied.text : "" } });
      expect(view.someProp("handleDOMEvents", (events) => events.paste?.(view, event))).toBe(true);
      const save = () => serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 6, textColorVersion: 1 });
      const before = save();
      expect(before).toContain('data-wenyou-color-v1="#D14343"');
      expect(before).toContain("**中文😀**");
      expect(before).toContain("`代码`");
      const slice = view.state.doc.slice(0, view.state.doc.content.size);
      const copiedAgain = view.someProp("clipboardSerializer")!.serializeFragment(slice.content);
      expect(copiedAgain.querySelector('[data-wenyou-color-v1="#D14343"]')).not.toBeNull();
      expect(view.someProp("clipboardTextSerializer")!(slice, view)).toBe("中文😀 代码");
      view.dispatch(closeHistory(view.state.tr).setSelection(TextSelection.create(view.state.doc, 1, view.state.doc.firstChild!.nodeSize - 1))
        .removeMark(1, view.state.doc.firstChild!.nodeSize - 1, view.state.schema.marks.wenyouTextColor!));
      expect(save()).not.toContain("data-wenyou-color-v1");
      expect(save()).toContain("**中文😀**");
      expect(undo(view.state, view.dispatch)).toBe(true);
      expect(save()).toBe(before);
      expect(redo(view.state, view.dispatch)).toBe(true);
      expect(save()).not.toContain("data-wenyou-color-v1");
    });
  } finally { await crepe.destroy(); root.remove(); }
});

test("彩色文字内新增换行、提及与传送门自动跳过颜色，普通链接和代码保持颜色", async () => {
  const root = document.createElement("div"); document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: "" });
  crepe.editor.config(configureTextColorTestEditor).use(editorTextColorSchema)
    .use(editorBoundaryTextSchema).use(editorTextColorAtomicPolicy);
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx), schema = view.state.schema;
      const color = schema.marks.wenyouTextColor!.create({ color: "#D14343" });
      const mention = schema.marks.link!.create({ href: "/users/c111111111111111111111111" });
      const link = schema.marks.link!.create({ href: "https://example.com" });
      const paragraph = schema.nodes.paragraph!.create(null, [
        schema.text("有色", [color]),
        schema.nodes.hardbreak!.create(null, null, [color]),
        schema.text("@用户", [color, mention]),
        schema.text("传送门", [color, schema.marks.link!.create({ href: "/threads/c111111111111111111111111" })]),
        schema.text("链接", [color, link]),
        schema.text("@全体玩家", [color, schema.marks.inlineCode!.create()]),
      ]);
      view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, paragraph));
      const coloredAtoms: string[] = [];
      view.state.doc.descendants((node) => {
        if (node.marks.some((mark) => mark.type === color.type) && (node.type.name === "hardbreak"
          || node.text === "@用户" || node.text === "传送门")) coloredAtoms.push(node.type.name);
      });
      expect(coloredAtoms).toEqual([]);
      const saved = serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 6, textColorVersion: 1 });
      expect(saved).toContain("[@用户](/users/c111111111111111111111111)");
      expect(saved).toContain('[链接](https://example.com)');
      expect(saved).toContain('data-wenyou-color-v1');
    });
  } finally { await crepe.destroy(); root.remove(); }
});

test("编码器丢失颜色时禁止成功保存并保留编辑文档", async () => {
  const root = document.createElement("div"); document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: '<span data-wenyou-color-v1="#D14343">原文</span>' });
  crepe.editor.config(configureTextColorTestEditor).use(editorTextColorSchema);
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const before = view.state.doc.toJSON();
      ctx.set(serializerCtx, () => "原文");
      expect(() => serializeEditorMarkdown(ctx, view.state.doc, { textColorVersion: 1 })).toThrow("文字颜色保存校验失败");
      expect(view.state.doc.toJSON()).toEqual(before);
    });
  } finally { await crepe.destroy(); root.remove(); }
});

const escapedLiterals = [
  String.raw`\@全体玩家`,
  String.raw`\[\[dice:v1:11111111-1111-4111-8111-111111111111:1d6\]\]`,
  String.raw`\/threads/c111111111111111111111111`,
];
test.each(escapedLiterals)("转义字面 %s 在实际骰子插件、复制粘贴及后续编辑中保持颜色", async (literal) => {
  const root = document.createElement("div"); document.body.append(root);
  const source = `<span data-wenyou-color-v1="#D14343">**${literal}**</span> 末尾`;
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(source) });
  crepe.editor.config(configureTextColorTestEditor).use(editorTextColorSchema)
    .use(editorBoundaryTextSchema).use(editorAttentionBoundaryParser).use(editorTextColorAtomicPolicy)
    .use(editorMarkdownPastePlugin);
  const dice = createDiceInlineEditorPlugins();
  crepe.editor.use(dice.remarkDiceInline).use(dice.diceInlineSchema).use(dice.clonePastedDice);
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const plain = literal.replaceAll("\\", "");
      const initial = view.state.doc;
      expect(initial.textContent).toBe(plain + " 末尾");
      expect(root.querySelector('[data-wenyou-color-v1]')?.textContent).toBe(plain);
      const save = () => serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 6, textColorVersion: 1 });
      exported.push({ source, saved: save() });
      view.dispatch(view.state.tr.insertText("改", initial.content.size - 1));
      expect(root.querySelector('[data-wenyou-color-v1]')?.textContent).toBe(plain);
      const saved = save();
      expect(ctx.get(parserCtx)(prepareEditorMarkdown(saved))?.toJSON()).toEqual(view.state.doc.toJSON());
      const copied = createReaderClipboardPayload(root.querySelector(".ProseMirror")!);
      expect(copied.html).toContain("data-wenyou-color-v1");
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, view.state.doc.content.size - 1)));
      const event = new Event("paste", { cancelable: true }) as ClipboardEvent;
      Object.defineProperty(event, "clipboardData", { value: { files: [], types: ["text/html", "text/plain"],
        getData: (type: string) => type === "text/html" ? copied.html : type === "text/plain" ? copied.text : "" } });
      expect(view.someProp("handleDOMEvents", (events) => events.paste?.(view, event))).toBe(true);
      expect(save()).toBe(saved);
    });
  } finally { await crepe.destroy(); root.remove(); }
});

// 跨端联验只读取测试内容产物；使用生产对齐、颜色和软换行入口，并执行保存一致性检查。
if (process.env.WENYOU_TEXT_COLOR_IMPORT) {
  const imported = JSON.parse(readFileSync(process.env.WENYOU_TEXT_COLOR_IMPORT, "utf8")) as
    { source: string; saved?: string }[] | { cases: { source: string; saved?: string }[] };
  const artifacts = Array.isArray(imported) ? imported : imported.cases;
  test.each(artifacts)("App 编码产物经实际 Web 编辑器再保存：%#", async ({ source, saved }) => {
    const root = document.createElement("div"); document.body.append(root);
    const input = saved ?? source;
    const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(input) });
    crepe.editor.config(configureTextColorTestEditor).use(editorTextColorSchema)
      .use(editorBoundaryTextSchema).use(editorAttentionBoundaryParser).use(editorSoftBreakParser).use(editorTextColorAtomicPolicy);
    const dice = createDiceInlineEditorPlugins();
    crepe.editor.use(dice.remarkDiceInline).use(dice.diceInlineSchema).use(dice.clonePastedDice);
    try {
      await crepe.create();
      crepe.editor.action((ctx) => {
        const doc = ctx.get(editorViewCtx).state.doc;
        const saved = serializeEditorMarkdown(ctx, doc, { markdownContractVersion: 6, textColorVersion: 1 });
        expect(semanticJson(ctx.get(parserCtx)(prepareEditorMarkdown(saved))?.toJSON())).toEqual(semanticJson(doc.toJSON()));
        exported.push({ source: input, saved });
      });
    } finally { await crepe.destroy(); root.remove(); }
  });
}
