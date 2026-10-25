import type { Node } from "@milkdown/kit/prose/model";
import type { EditorState } from "@milkdown/kit/prose/state";

/** 混合段落或历史层级不误选正文；读取选区结构，不解析工具栏标签。 */
export function getSelectedEditorHeading(state: EditorState): 0 | 2 | 3 | undefined {
  const level = (node: Node) => node.type.name === "paragraph" ? 0
    : node.type.name === "heading" && (node.attrs.level === 2 || node.attrs.level === 3) ? node.attrs.level as 2 | 3
      : undefined;
  if (state.selection.empty) return level(state.selection.$from.parent);
  const levels = new Set<0 | 2 | 3 | undefined>();
  state.doc.nodesBetween(state.selection.from, state.selection.to, node => {
    if (!node.isTextblock) return;
    levels.add(level(node));
    return false;
  });
  return levels.size === 1 ? levels.values().next().value : undefined;
}
