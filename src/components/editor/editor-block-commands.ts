import { commandsCtx } from "@milkdown/core";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { EditorState, Plugin, PluginKey, TextSelection, type Command, type Transaction } from "@milkdown/kit/prose/state";
import { closeHistory } from "@milkdown/kit/prose/history";
import { liftListItem } from "@milkdown/kit/prose/schema-list";
import { canJoin, liftTarget } from "@milkdown/kit/prose/transform";
import { wrapInBlockquoteCommand, wrapInHeadingCommand } from "@milkdown/kit/preset/commonmark";
import { $prose } from "@milkdown/kit/utils";
import { AUTO_TRAILING_PARAGRAPH } from "./editor-trailing-paragraph";

type TextRow = { from: number; to: number; block: number; quoted: boolean };
type BlockStyle = "quote" | 0 | 2 | 3;

/** 显式 break 才分行；选区右端采用半开区间，光标则作用于所在行。 */
function selectedRows(state: EditorState): TextRow[] {
  const { from, to, empty } = state.selection;
  const rows: TextRow[] = [];
  state.doc.descendants((node, position) => {
    if (node.type.name !== "paragraph" && node.type.name !== "heading") return true;
    if (!empty && node.attrs[AUTO_TRAILING_PARAGRAPH]) return false;
    const $start = state.doc.resolve(position + 1);
    const quoted = Array.from({ length: $start.depth }, (_, depth) => $start.node(depth).type.name)
      .includes("blockquote");
    let start = position + 1;
    const add = (end: number) => {
      if (empty ? from >= start && from <= end : from <= end && to > start) {
        rows.push({ from: start, to: end, block: position, quoted });
      }
    };
    node.forEach((child, offset) => {
      if (child.type.name !== "hardbreak") return;
      add(position + 1 + offset);
      start = position + 2 + offset;
    });
    add(position + 1 + node.content.size);
    return false;
  });
  return rows;
}

export function isSelectedQuote(state: EditorState): boolean {
  const rows = selectedRows(state);
  return rows.length > 0 && rows.every(row => row.quoted);
}

function splitRowEdges(tr: Transaction, row: TextRow) {
  // 先拆尾再拆头，用映射定位；显式 break 被块边界替代，不增加可见空行。
  const end = tr.mapping.map(row.to);
  if (tr.doc.nodeAt(end)?.type.name === "hardbreak") tr.delete(end, end + 1).split(end);
  const start = tr.mapping.map(row.from);
  if (tr.doc.resolve(start).parentOffset > 0) {
    tr.delete(start - 1, start).split(start - 1);
  }
}

/** 拆开旧容器后提到顶层，避免把新引用嵌套进列表／引用，或留下引用标题。 */
function liftTextBlock(tr: Transaction, originalPosition: number): boolean {
  for (;;) {
    const position = tr.mapping.map(originalPosition);
    const $position = tr.doc.resolve(position);
    if ($position.depth === 1) return true;
    const range = $position.blockRange();
    if (!range) return false;
    const target = liftTarget(range);
    if (target !== null) {
      tr.lift(range, target);
      continue;
    }
    // 首段后跟子列表时，list_item 不能直接切掉首段；先按标准列表命令提取该项。
    const item = tr.doc.type.schema.nodes.list_item;
    if (!item) return false;
    const projected = EditorState.create({ doc: tr.doc, selection: TextSelection.create(tr.doc, position) });
    if (!liftListItem(item)(projected, next => { next.steps.forEach(step => tr.step(step)); })) return false;
  }
}

function joinAdjacentQuotes(tr: Transaction, originalPosition: number) {
  let $position = tr.doc.resolve(tr.mapping.map(originalPosition));
  let before = $position.before(1);
  if (before > 0 && tr.doc.resolve(before).nodeBefore?.type.name === "blockquote" && canJoin(tr.doc, before)) tr.join(before);
  $position = tr.doc.resolve(tr.mapping.map(originalPosition));
  before = $position.after(1);
  if (before < tr.doc.content.size && tr.doc.resolve(before).nodeAfter?.type.name === "blockquote" && canJoin(tr.doc, before)) tr.join(before);
}

function headingAlignment(node: ProseNode) {
  let eligible = false;
  let image = false;
  node.forEach(child => {
    if (child.type.name === "image") image = true;
    if (child.isText ? /\S/u.test(child.text ?? "") : child.isInline && child.isAtom && child.type.name !== "hardbreak") eligible = true;
  });
  return eligible && !image ? node.attrs.textAlign : "left";
}

/** 行级块转换共用一个事务；正文／标题清除原块样式，行内 marks 原样保留。 */
export function setSelectedBlockStyle(style: BlockStyle): Command {
  return (state, dispatch) => {
    const rows = selectedRows(state);
    if (!rows.length) return false;
    const target = style === "quote" && rows.every(row => row.quoted) ? 0 : style;
    // 引用及正文保留原段内连续行；标题每个逻辑行独立成为一个 H2/H3。
    const groups: TextRow[] = [];
    for (const row of rows) {
      const previous = groups.at(-1);
      if ((target === "quote" || target === 0) && previous?.block === row.block) previous.to = row.to;
      else groups.push({ ...row });
    }
    const tr = closeHistory(state.tr);
    for (const row of [...groups].reverse()) {
      const original = state.doc.resolve(row.from);
      if (target === 0 && original.depth === 1 && original.parent.type.name === "paragraph") continue;
      splitRowEdges(tr, row);
      if (!liftTextBlock(tr, row.from)) return false;
      let $position = tr.doc.resolve(tr.mapping.map(row.from));
      const node = $position.parent;
      const type = target === 2 || target === 3 ? state.schema.nodes.heading! : state.schema.nodes.paragraph!;
      const attrs = { ...(target === 2 || target === 3 ? { level: target } : {}),
        textAlign: target === "quote" ? "left" : headingAlignment(node), [AUTO_TRAILING_PARAGRAPH]: false };
      tr.setNodeMarkup($position.before(), type, attrs);
      if (target === "quote") {
        $position = tr.doc.resolve(tr.mapping.map(row.from));
        const range = $position.blockRange()!;
        tr.wrap(range, [{ type: state.schema.nodes.blockquote! }]);
        joinAdjacentQuotes(tr, row.from);
      }
    }
    tr.setSelection(state.selection.map(tr.doc, tr.mapping));
    if (state.selection.empty) tr.setStoredMarks(state.storedMarks ?? state.selection.$from.marks());
    if (dispatch) {
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** 覆盖既有 key，主栏、更多与显式快捷键共享行为。 */
export const editorBlockCommands = $prose(ctx => new Plugin({
  key: new PluginKey("wenyousite-block-commands"),
  view: () => {
    const commands = ctx.get(commandsCtx);
    commands.create(wrapInBlockquoteCommand.key, () => setSelectedBlockStyle("quote"));
    commands.create(wrapInHeadingCommand.key, level => setSelectedBlockStyle(level === 2 || level === 3 ? level : 0));
    return {};
  },
}));
