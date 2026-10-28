import { commandsCtx } from "@milkdown/core";
import { insertHrCommand } from "@milkdown/kit/preset/commonmark";
import { closeHistory } from "@milkdown/kit/prose/history";
import { liftListItem } from "@milkdown/kit/prose/schema-list";
import { EditorState, NodeSelection, Plugin, PluginKey, Selection, TextSelection, type Command } from "@milkdown/kit/prose/state";
import { liftTarget } from "@milkdown/kit/prose/transform";
import { $prose } from "@milkdown/kit/utils";
import { AUTO_TRAILING_PARAGRAPH } from "./editor-trailing-paragraph";

/** 替换精确选区，分隔线独占顶层块；光标落在其后的可编辑正文。 */
export const insertEditorDivider: Command = (state, dispatch) => {
  const tr = closeHistory(state.tr).replaceSelectionWith(state.schema.nodes.hr!.create());
  let inserted = -1;
  // replaceRangeWith 在段尾可能把插入点移到块外，以真实 step 的新区间定位。
  tr.mapping.maps.forEach((map, index) => map.forEach((_from, _to, start, end) => {
    const remaining = tr.mapping.slice(index + 1);
    tr.doc.nodesBetween(remaining.map(start, -1), remaining.map(end), (node, pos) => {
      if (node.type.name === "hr") inserted = pos;
    });
  }));
  if (inserted < 0) return false;
  const mapStart = tr.mapping.maps.length;
  const position = () => tr.mapping.slice(mapStart).map(inserted);
  for (;;) {
    const from = position();
    const $from = tr.doc.resolve(from);
    if ($from.depth === 0) break;
    const range = $from.blockRange(tr.doc.resolve(from + 1));
    if (!range) return false;
    const target = liftTarget(range);
    if (target !== null) tr.lift(range, target);
    else {
      const projected = EditorState.create({ doc: tr.doc, selection: NodeSelection.create(tr.doc, from) });
      if (!liftListItem(state.schema.nodes.list_item!)(projected, next => next.steps.forEach(step => tr.step(step)))) return false;
    }
  }
  const after = position() + 1;
  const next = tr.doc.nodeAt(after);
  if (!next || next.isAtom) {
    tr.insert(after, state.schema.nodes.paragraph!.create({ [AUTO_TRAILING_PARAGRAPH]: after === tr.doc.content.size }));
  }
  const following = Selection.findFrom(tr.doc.resolve(after), 1, true);
  if (!(following instanceof TextSelection)) return false;
  tr.setSelection(following);
  dispatch?.(tr.scrollIntoView());
  return true;
};

export const editorDividerCommand = $prose(ctx => new Plugin({
  key: new PluginKey("wenyousite-divider-command"),
  view: () => {
    ctx.get(commandsCtx).create(insertHrCommand.key, () => insertEditorDivider);
    return {};
  },
}));
