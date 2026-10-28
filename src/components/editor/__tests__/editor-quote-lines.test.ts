import { CrepeBuilder } from "@milkdown/crepe/builder";
import { commandsCtx, editorViewCtx, parserCtx } from "@milkdown/core";
import { wrapInBlockquoteCommand, wrapInHeadingCommand, insertHrCommand, toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand } from "@milkdown/kit/preset/commonmark";
import { TextSelection, NodeSelection, AllSelection } from "@milkdown/kit/prose/state";
import { closeHistory, redo, undo } from "@milkdown/kit/prose/history";
import { afterAll, expect, test } from "vitest";
import { configureEditorAlignmentParser, configureEditorAlignmentSchemas, createEditorAlignmentPlugin, setSelectedTextAlignment } from "../editor-alignment";
import { configureEditorMarkdownSerializer, createEditorMarkdownBridge, editorSoftBreakParser,
  prepareEditorMarkdown, serializeEditorMarkdown } from "../milkdown-markdown-codec";
import { imageBlock } from "@milkdown/crepe/feature/image-block";
import { createDiceInlineEditorPlugins } from "../dice-inline-plugin";
import { editorTextColorSchema } from "../editor-text-color";
import { editorTextFontSchema } from "../editor-text-font";
import { editorDividerCommand } from "../editor-divider-command";
import { editorInlineCodeCommand, isInlineStyleActive } from "../editor-inline-code";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { editorBlockCommands } from "../editor-block-commands";
import type { Ctx } from "@milkdown/kit/ctx";

const capabilities = { markdownContractVersion: 6, textColorVersion: 1, textFontVersion: 1 } as const;

async function withEditor(source: string, run: (ctx: Ctx) => void) {
  const root = document.createElement("div"); document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(source, capabilities) });
  crepe.addFeature(imageBlock);
  const dice = createDiceInlineEditorPlugins();
  crepe.editor.use(dice.remarkDiceInline).use(dice.diceInlineSchema).use(editorTextColorSchema).use(editorTextFontSchema);
  crepe.editor.config(configureEditorMarkdownSerializer)
    .config(ctx => configureEditorAlignmentParser(ctx, capabilities))
    .config(ctx => configureEditorAlignmentSchemas(ctx, capabilities))
    .use(editorInlineCodeCommand).use(editorDividerCommand).use(editorBlockCommands).use(editorSoftBreakParser).use(createEditorAlignmentPlugin(() => {}))
    .use(createEditorMarkdownBridge({ markdownContractVersion: 6, textColorVersion: 1, textFontVersion: 1, onChange: () => {}, onError: error => { throw error; } }));
  try { await crepe.create(); crepe.editor.action(run); }
  finally { await crepe.destroy(); root.remove(); }
}

function textPosition(ctx: Ctx, text: string, offset = 0) {
  let position = -1;
  ctx.get(editorViewCtx).state.doc.descendants((node, pos) => {
    if (node.isText && node.text!.includes(text)) position = pos + node.text!.indexOf(text) + offset;
  });
  expect(position).toBeGreaterThan(0);
  return position;
}
function select(ctx: Ctx, from: number, to = from) {
  const view = ctx.get(editorViewCtx);
  view.dispatch(closeHistory(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to))));
}
function toggle(ctx: Ctx) { expect(ctx.get(commandsCtx).call(wrapInBlockquoteCommand.key)).toBe(true); }
function saved(ctx: Ctx) { return serializeEditorMarkdown(ctx, ctx.get(editorViewCtx).state.doc, capabilities); }
function roundtrip(ctx: Ctx, expected: string) {
  expect(saved(ctx)).toBe(expected);
  const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(expected, capabilities));
  expect(serializeEditorMarkdown(ctx, reopened, capabilities)).toBe(expected);
}

afterAll(async () => { await new Promise(resolve => setTimeout(resolve, 3100)); });

for (const collapsed of [false, true]) {
  test(`${collapsed ? "光标" : "局部选区"}只引用同段中间逻辑行并可取消`, async () => {
    await withEditor("首行\n中间文字\n末行", ctx => {
      const from = textPosition(ctx, "中间文字", 1);
      select(ctx, from, collapsed ? from : from + 2);
      const original = ctx.get(editorViewCtx).state.selection;
      toggle(ctx);
      roundtrip(ctx, "首行\n\n> 中间文字\n\n末行");
      const view = ctx.get(editorViewCtx);
      expect(view.state.selection.empty).toBe(collapsed);
      expect(view.state.selection.$from.parentOffset).toBe(1);
      if (!collapsed) expect(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to)).toBe("间文");
      expect(undo(view.state, view.dispatch)).toBe(true);
      expect(saved(ctx)).toBe("首行\n中间文字\n末行");
      expect(view.state.selection.eq(original)).toBe(true);
      expect(redo(view.state, view.dispatch)).toBe(true);
      roundtrip(ctx, "首行\n\n> 中间文字\n\n末行");
      toggle(ctx);
      roundtrip(ctx, "首行\n\n中间文字\n\n末行");
    });
  });
}

test("跨行选区终点在下一行起点时排除该行，保留反向选区", async () => {
  await withEditor("甲行\n乙行\n丙行\n丁行", ctx => {
    select(ctx, textPosition(ctx, "丁行"), textPosition(ctx, "乙行", 1));
    toggle(ctx);
    roundtrip(ctx, "甲行\n\n> 乙行\n> 丙行\n\n丁行");
    const selection = ctx.get(editorViewCtx).state.selection;
    expect(selection.anchor).toBeGreaterThan(selection.head);
    expect(selection.$anchor.parent.textContent).toBe("丁行");
    expect(selection.$anchor.parentOffset).toBe(0);
  });
});

const quoteCases = [
  { name: "取消引用中间行不会作为 lazy continuation 被吞回", source: "> 首行\n> 中行\n> 末行", start: "中行", end: "中行", offset: 2, expected: "> 首行\n\n中行\n\n> 末行" },
  { name: "取消引用保留原引用段落边界", source: "> 甲\n>\n> 乙\n> 丙\n>\n> 丁", start: "乙", end: "乙", offset: 1, expected: "> 甲\n\n乙\n\n> 丙\n>\n> 丁" },
  { name: "已有引用与正文混选统一引用且不嵌套", source: "> 甲\n\n乙\n\n丙", start: "甲", end: "乙", offset: 1, expected: "> 甲\n>\n> 乙\n\n丙" },
  { name: "跨段终点在下一段起点不包含该段", source: "甲\n\n乙\n\n丙", start: "甲", end: "乙", offset: 0, expected: "> 甲\n\n乙\n\n丙" },
  { name: "标题转引用清除标题但保留邻行", source: "## 标题\n\n正文", start: "标题", end: "标题", offset: 2, expected: "> 标题\n\n正文" },
  { name: "中间列表项转引用保留相邻列表", source: "* 甲\n* 乙\n* 丙", start: "乙", end: "乙", offset: 1, expected: "* 甲\n\n> 乙\n\n* 丙" },
  { name: "列表项内部分逻辑行转引用不带入其他行", source: "* 甲\n  乙\n  丙\n* 丁", start: "乙", end: "乙", offset: 1, expected: "* 甲\n\n> 乙\n\n* 丙\n\n* 丁" },
  { name: "父列表项转引用保留子列表内容", source: "* 甲\n  * 子项\n* 乙", start: "甲", end: "甲", offset: 1, expected: "> 甲\n\n* 子项\n\n- 乙" },
  { name: "相邻显式空行数量保留", source: "甲\n<br />\n<br />\n乙", start: "甲", end: "乙", offset: 0, expected: "> 甲\n> <br />\n> <br />\n\n乙" },
  { name: "跨分隔线混选只转换文字", source: "甲\n\n---\n\n乙", start: "甲", end: "乙", offset: 1, expected: "> 甲\n\n---\n\n> 乙" },
];
for (const item of quoteCases) test(item.name, async () => {
  await withEditor(item.source, ctx => {
    select(ctx, textPosition(ctx, item.start), textPosition(ctx, item.end, item.offset));
    const before = saved(ctx);
    const original = ctx.get(editorViewCtx).state.selection;
    toggle(ctx);
    roundtrip(ctx, item.expected);
    const view = ctx.get(editorViewCtx);
    const selection = view.state.selection;
    expect(undo(view.state, view.dispatch)).toBe(true);
    expect(saved(ctx)).toBe(before);
    expect(view.state.selection.eq(original)).toBe(true);
    expect(redo(view.state, view.dispatch)).toBe(true);
    roundtrip(ctx, item.expected);
    expect(view.state.selection.eq(selection)).toBe(true);
  });
});

for (const source of ["", "甲\n<br />\n乙", "> 甲\n> <br />\n> 乙"]) {
  test(`空行光标切换引用：${source}`, async () => {
    await withEditor(source, ctx => {
      const view = ctx.get(editorViewCtx);
      let emptyPosition = -1;
      view.state.doc.descendants((node, pos) => { if (node.type.name === "paragraph" && !node.content.size && !node.attrs.wenyouAutoTrailing) emptyPosition = pos + 1; });
      select(ctx, emptyPosition);
      toggle(ctx);
      expect(view.state.selection.empty).toBe(true);
      const expected = source === "" ? ">\n\n<br />" : source.startsWith(">") ? "> 甲\n<br />\n> 乙" : "甲\n\n>\n\n乙";
      roundtrip(ctx, expected);
    });
  });
}

test("整行引用转换保留链接、代码和叠加 marks", async () => {
  await withEditor("首行\n**[中间文字](https://example.com)**\n末行", ctx => {
    const view = ctx.get(editorViewCtx);
    const from = textPosition(ctx, "中间文字");
    select(ctx, from, from + 4);
    const before = view.state.selection.content().content.toJSON();
    toggle(ctx);
    expect(view.state.selection.$from.parent.content.toJSON()).toEqual(before[0].content);
    roundtrip(ctx, "首行\n\n> **[中间文字](https://example.com)**\n\n末行");
  });
});

for (const level of [0, 2, 3]) {
  test(`引用中间行转换为 ${level || "正文"}，其余行保留`, async () => {
    await withEditor("> 甲\n> 乙\n> 丙", ctx => {
      select(ctx, textPosition(ctx, "乙"));
      ctx.get(commandsCtx).call(wrapInHeadingCommand.key, level);
      roundtrip(ctx, `> 甲\n\n${level ? "#".repeat(level) + " " : ""}乙\n\n> 丙`);
    });
  });
  test(`普通段落中间行转换为 ${level || "正文"}，终点行排除`, async () => {
    await withEditor("甲\n乙\n丙\n丁", ctx => {
      select(ctx, textPosition(ctx, "乙"), textPosition(ctx, "丁"));
      ctx.get(commandsCtx).call(wrapInHeadingCommand.key, level);
      roundtrip(ctx, level ? `甲\n\n${"#".repeat(level)} 乙\n\n${"#".repeat(level)} 丙\n\n丁` : "甲\n乙\n丙\n丁");
    });
  });
}

test("部分居中段落转标题保留前后对齐，转引用只清除选中行对齐", async () => {
  await withEditor("[wenyousite-align-v1-center]: #\n甲\n乙\n丙", ctx => {
    select(ctx, textPosition(ctx, "乙"));
    ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 2);
    roundtrip(ctx, "[wenyousite-align-v1-center]: #\n甲\n\n[wenyousite-align-v1-center]: #\n## 乙\n\n[wenyousite-align-v1-center]: #\n丙");
    toggle(ctx);
    roundtrip(ctx, "[wenyousite-align-v1-center]: #\n甲\n\n> 乙\n\n[wenyousite-align-v1-center]: #\n丙");
  });
});

for (const [command, name, markdown] of [
  [toggleStrongCommand, "strong", "**甲**乙"],
  [toggleEmphasisCommand, "emphasis", "*甲*乙"],
  [toggleStrikethroughCommand, "strike_through", "~~甲~~乙"],
  [toggleInlineCodeCommand, "inlineCode", "`甲`乙"],
] as const) test(`${name} 混合选区先统一，再取消，支持历史和空光标`, async () => {
  await withEditor(markdown, ctx => {
    const view = ctx.get(editorViewCtx);
    select(ctx, 1, 3);
    expect(isInlineStyleActive(view.state, name)).toBe(false);
    ctx.get(commandsCtx).call(command.key);
    expect(isInlineStyleActive(view.state, name)).toBe(true);
    const formatted = saved(ctx);
    roundtrip(ctx, formatted);
    expect(undo(view.state, view.dispatch)).toBe(true);
    expect(saved(ctx)).toBe(markdown);
    expect(redo(view.state, view.dispatch)).toBe(true);
    expect(saved(ctx)).toBe(formatted);
    ctx.get(commandsCtx).call(command.key);
    expect(isInlineStyleActive(view.state, name)).toBe(false);
    expect(saved(ctx)).toBe("甲乙");
    select(ctx, 3);
    ctx.get(commandsCtx).call(command.key);
    view.dispatch(view.state.tr.insertText("丙"));
    expect(view.state.selection.$from.nodeBefore!.marks.some(mark => mark.type.name === name)).toBe(true);
  });
});

for (const source of ["甲乙", "> 甲乙", "## 甲乙", "* 甲乙"]) {
  test(`分隔线替换精确选区并独占顶层块：${source}`, async () => {
    await withEditor(source, ctx => {
      const view = ctx.get(editorViewCtx);
      select(ctx, textPosition(ctx, "甲乙", 1));
      expect(ctx.get(commandsCtx).call(insertHrCommand.key)).toBe(true);
      expect(view.state.doc.child(1).type.name).toBe("hr");
      expect(view.state.selection.$from.parent.type.name).toBe(source.startsWith("##") ? "heading" : "paragraph");
      expect(view.state.selection.$from.parentOffset).toBe(0);
      expect(view.state.doc.textContent).toBe("甲乙");
      const markdown = saved(ctx);
      roundtrip(ctx, markdown);
      expect(undo(view.state, view.dispatch)).toBe(true);
      expect(view.state.doc.textContent).toBe("甲乙");
      expect(redo(view.state, view.dispatch)).toBe(true);
      expect(saved(ctx)).toBe(markdown);
    });
  });
}

test("分隔线插入末尾无额外作者空行，后续输入进入正文", async () => {
  await withEditor("甲乙", ctx => {
    const view = ctx.get(editorViewCtx);
    select(ctx, 3);
    expect(ctx.get(commandsCtx).call(insertHrCommand.key)).toBe(true);
    roundtrip(ctx, "甲乙\n\n---");
    view.dispatch(view.state.tr.insertText("后文"));
    roundtrip(ctx, "甲乙\n\n---\n\n后文");
  });
});

test("引用、标题及撤销重做保留颜色字体和行内代码叠加", async () => {
  const source = '首行\n<span data-wenyou-font-v1="wenkai"><span data-wenyou-color-v1="#D14343">**[文字](https://example.com)**</span></span>\n末行';
  await withEditor(source, ctx => {
    const view = ctx.get(editorViewCtx);
    select(ctx, textPosition(ctx, "文字"), textPosition(ctx, "文字", 2));
    ctx.get(commandsCtx).call(toggleInlineCodeCommand.key);
    const originalMarks = view.state.selection.$from.nodeAfter!.marks.map(mark => mark.toJSON());
    toggle(ctx);
    expect(view.state.selection.$from.nodeAfter!.marks.map(mark => mark.toJSON())).toEqual(originalMarks);
    ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 2);
    expect(view.state.selection.$from.parent.type.name).toBe("heading");
    expect(view.state.selection.$from.nodeAfter!.marks.map(mark => mark.toJSON())).toEqual(originalMarks);
    const encoded = saved(ctx);
    roundtrip(ctx, encoded);
    expect(undo(view.state, view.dispatch)).toBe(true);
    expect(view.state.selection.$from.node(1).type.name).toBe("blockquote");
    expect(redo(view.state, view.dispatch)).toBe(true);
    expect(saved(ctx)).toBe(encoded);
  });
});

test("真实骰子、图片及音频链接混选的行内格式可保存重开，原子节点不附加 mark", async () => {
  await withEditor("甲\n\n![图片](https://example.com/image.png)\n\n[音频](https://example.com/audio.mp3)\n\n乙", ctx => {
    const view = ctx.get(editorViewCtx);
    view.dispatch(view.state.tr.insert(2, view.state.schema.nodes.dice_inline!.create({ nodeId: "d1000000-0000-4000-8000-000000000001", notation: "1d6" })));
    view.dispatch(closeHistory(view.state.tr.setSelection(new AllSelection(view.state.doc))));
    const original = saved(ctx);
    ctx.get(commandsCtx).call(toggleStrongCommand.key);
    const encoded = saved(ctx);
    roundtrip(ctx, encoded);
    view.state.doc.descendants((node, position) => {
      if (!node.isAtom || node.isText) return;
      expect(node.marks).toEqual([]);
      if (node.type.name === "image-block" || node.type.name === "dice_inline") {
        const state = view.state;
        view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, position)));
        expect(ctx.get(commandsCtx).call(toggleStrongCommand.key)).toBe(false);
      }
    });
    expect(undo(view.state, view.dispatch)).toBe(true);
    expect(saved(ctx)).toBe(original);
  });
});

for (const reversed of [false, true]) test(`对齐按整段处理，但终点段排除（反向=${reversed}）`, async () => {
  await withEditor("甲\n乙\n\n丙", ctx => {
    const view = ctx.get(editorViewCtx);
    const start = textPosition(ctx, "乙"); const end = textPosition(ctx, "丙");
    select(ctx, reversed ? end : start, reversed ? start : end);
    expect(setSelectedTextAlignment(view, "center")).toBe(true);
    roundtrip(ctx, "[wenyousite-align-v1-center]: #\n甲\n乙\n\n丙");
    expect(view.state.selection.anchor > view.state.selection.head).toBe(reversed);
  });
});

test("仅含骰子的合法居中行转换标题保留对齐和骰子身份", async () => {
  await withEditor("甲", ctx => {
    const view = ctx.get(editorViewCtx);
    const nodeId = "d1000000-0000-4000-8000-000000000002";
    const dice = view.state.schema.nodes.dice_inline!.create({ nodeId, notation: "1d6" });
    view.dispatch(view.state.tr.replaceWith(1, 2, dice));
    select(ctx, 1);
    setSelectedTextAlignment(view, "center");
    ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 2);
    expect(view.state.doc.firstChild!.attrs.textAlign).toBe("center");
    expect(view.state.doc.firstChild!.firstChild!.attrs.nodeId).toBe(nodeId);
    roundtrip(ctx, saved(ctx));
  });
});

test("全选引用和标题转换保留合法全选与撤销历史", async () => {
  await withEditor("甲\n乙\n\n丙", ctx => {
    const view = ctx.get(editorViewCtx);
    view.dispatch(closeHistory(view.state.tr.setSelection(new AllSelection(view.state.doc))));
    toggle(ctx);
    expect(view.state.selection).toBeInstanceOf(AllSelection);
    roundtrip(ctx, "> 甲\n> 乙\n>\n> 丙");
    expect(undo(view.state, view.dispatch)).toBe(true);
    expect(view.state.selection).toBeInstanceOf(AllSelection);
    ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 2);
    expect(view.state.selection).toBeInstanceOf(AllSelection);
    roundtrip(ctx, "## 甲\n\n## 乙\n\n## 丙");
  });
});

test("引用中插分隔线保留前后引用，不新增作者空行", async () => {
  await withEditor("> 甲乙", ctx => {
    select(ctx, textPosition(ctx, "甲乙", 1));
    ctx.get(commandsCtx).call(insertHrCommand.key);
    roundtrip(ctx, "> 甲\n\n---\n\n> 乙");
    const view = ctx.get(editorViewCtx);
    expect(view.state.selection.$from.parent.textContent).toBe("乙");
    view.dispatch(view.state.tr.insertText("新"));
    roundtrip(ctx, "> 甲\n\n---\n\n> 新乙");
  });
});
