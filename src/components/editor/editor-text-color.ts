import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { parseMentionTarget } from "@/lib/mention";
import { parseInternalReference } from "@/lib/internal-reference";
import { $prose, $markSchema } from "@milkdown/kit/utils";
import { normalizeTextColor, TEXT_COLOR_ATTRIBUTE, TEXT_COLOR_MARK } from "@/lib/markdown-text-color";

/** 颜色标记共用保源与取色；DOM 只接受受控属性，不从 style 读取颜色。 */
export const editorTextColorSchema = $markSchema(TEXT_COLOR_MARK, () => ({
  attrs: { color: { default: null } },
  inclusive: false,
  parseDOM: [{
    tag: "span[" + TEXT_COLOR_ATTRIBUTE + "]",
    consuming: false,
    getAttrs: (element: HTMLElement) => {
      const color = normalizeTextColor((element as HTMLElement).getAttribute(TEXT_COLOR_ATTRIBUTE));
      return color ? { color } : false;
    },
  }],
  toDOM: (mark) => {
    const color = normalizeTextColor(mark.attrs.color);
    return ["span", color ? { [TEXT_COLOR_ATTRIBUTE]: color, style: "color: " + color } : {}, 0];
  },
  parseMarkdown: {
    match: (node) => node.type === TEXT_COLOR_MARK,
    runner: (state, node, type) => {
      const color = normalizeTextColor(node.color);
      if (!color) return;
      state.openMark(type, { color });
      state.next(node.children);
      state.closeMark(type);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === TEXT_COLOR_MARK,
    runner: (state, mark) => {
      state.withMark(mark, TEXT_COLOR_MARK, undefined, { color: normalizeTextColor(mark.attrs.color) });
    },
  },
  priority: 1,
}));

/** 在彩色文字中插入换行或原子内容时，只移除新原子范围上的颜色。 */
export const editorTextColorAtomicPolicy = $prose(() => new Plugin({
  key: new PluginKey("wenyou-text-color-atoms"),
  appendTransaction: (transactions, _oldState, state) => {
    if (!transactions.some((transaction) => transaction.docChanged)) return null;
    const color = state.schema.marks[TEXT_COLOR_MARK];
    if (!color) return null;
    const transaction = state.tr;
    state.doc.descendants((node, position) => {
      if (!node.marks.some((mark) => mark.type === color)) return;
      if (!node.isText) {
        if (node.isAtom) transaction.removeMark(position, position + node.nodeSize, color);
        return;
      }
      const text = node.text ?? "";
      const link = node.marks.find((mark) => mark.type.name === "link");
      if (link && (parseMentionTarget(link.attrs.href, text) || parseInternalReference(link.attrs.href))) {
        transaction.removeMark(position, position + node.nodeSize, color);
        return;
      }

    });
    return transaction.steps.length ? transaction : null;
  },
}));
