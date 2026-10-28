import { commandsCtx } from "@milkdown/core";
import { toggleEmphasisCommand, toggleInlineCodeCommand, toggleStrongCommand } from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { toggleMark } from "@milkdown/kit/prose/commands";
import { Plugin, PluginKey, type Command, type EditorState } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";

/** 只格式化允许该 mark 的真实文字；换行和媒体等原子节点不参与判定或写入。 */
function selectedTextRanges(state: EditorState, name: string) {
  const mark = state.schema.marks[name];
  const result: { from: number; to: number; active: boolean }[] = [];
  if (!mark) return result;
  for (const { $from, $to } of state.selection.ranges) {
    state.doc.nodesBetween($from.pos, $to.pos, (node, pos, parent) => {
      if (node.isAtom && !node.isText) return false;
      if (!node.isText || !parent?.type.allowsMarkType(mark)) return;
      result.push({ from: Math.max(pos, $from.pos), to: Math.min(pos + node.nodeSize, $to.pos),
        active: Boolean(mark.isInSet(node.marks)) });
    });
  }
  return result;
}

/** 混合选区先统一应用；只有所选文字全部具有该格式时才取消。 */
export function isInlineStyleActive(state: EditorState, name: string): boolean {
  const mark = state.schema.marks[name];
  if (!mark) return false;
  if (state.selection.empty) return Boolean(mark.isInSet(state.storedMarks ?? state.selection.$from.marks()));
  const ranges = selectedTextRanges(state, name);
  return ranges.length > 0 && ranges.every(range => range.active);
}

export function toggleInlineStyle(name: string): Command {
  return (state, dispatch) => {
    const mark = state.schema.marks[name];
    if (!mark) return false;
    if (state.selection.empty) return toggleMark(mark)(state, dispatch);
    const ranges = selectedTextRanges(state, name);
    if (!ranges.length) return false;
    if (dispatch) {
      const tr = state.tr;
      const remove = ranges.every(range => range.active);
      for (const { from, to } of ranges) {
        if (remove) tr.removeMark(from, to, mark);
        else tr.addMark(from, to, mark.create());
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** 沿用原 command key，四种行内格式及快捷键均可叠加、取消和用于后续输入。 */
export const editorInlineCodeCommand = $prose(ctx => new Plugin({
  key: new PluginKey("wenyousite-inline-code-command"),
  view: () => {
    const commands = ctx.get(commandsCtx);
    commands.create(toggleStrongCommand.key, () => toggleInlineStyle("strong"));
    commands.create(toggleEmphasisCommand.key, () => toggleInlineStyle("emphasis"));
    commands.create(toggleStrikethroughCommand.key, () => toggleInlineStyle("strike_through"));
    commands.create(toggleInlineCodeCommand.key, () => toggleInlineStyle("inlineCode"));
    return {};
  },
}));
