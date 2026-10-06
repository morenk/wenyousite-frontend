import { Plugin, PluginKey, TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { Node } from "@milkdown/kit/prose/model";
import { $prose } from "@milkdown/kit/utils";
import { getMentionUserId } from "@/lib/mention";

/** 段尾提及为不可编辑的 link mark，提供链接外光标位置；不向文档增加字符。 */
export function mentionCaretDecorations(doc: Node) {
  const decorations: Decoration[] = [];
  doc.descendants((node, position) => {
    if (!node.isTextblock) return true;
    const last = node.lastChild;
    const link = last?.marks.find((mark) => mark.type.name === "link");
    if (last?.isText && link && getMentionUserId(link.attrs.href, last.text)) {
      const end = position + node.nodeSize - 1;
      decorations.push(Decoration.widget(end, () => {
        const element = document.createElement("span");
        element.dataset.editorMentionCaret = "true";
        element.setAttribute("aria-hidden", "true");
        return element;
      }, { side: 1, marks: [], key: "mention-caret:" + end }));
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

/** 不可编辑提及外侧的输入不能继承 link mark，否则首字又把光标锁回实体。 */
function isMentionBoundary(state: EditorState, from: number, to: number) {
  if (from !== to) return false;
  const position = state.doc.resolve(from);
  const before = position.nodeBefore, after = position.nodeAfter;
  const beforeLink = before?.marks.find((mark) => mark.type.name === "link");
  const afterLink = after?.marks.find((mark) => mark.type.name === "link");
  const end = before?.isText && beforeLink && getMentionUserId(beforeLink.attrs.href, before.text)
    && !afterLink?.eq(beforeLink);
  const start = after?.isText && afterLink && getMentionUserId(afterLink.attrs.href, after.text)
    && !beforeLink?.eq(afterLink);
  return Boolean(end || start);
}

export function mentionBoundaryTextTransaction(state: EditorState, from: number, to: number, text: string) {
  if (!isMentionBoundary(state, from, to)) return null;
  const marks = (state.storedMarks ?? state.doc.resolve(from).marks()).filter((mark) => mark.type.name !== "link");
  const transaction = state.tr.replaceWith(from, to, state.schema.text(text, marks));
  return transaction.setSelection(TextSelection.create(transaction.doc, from + text.length)).setStoredMarks(marks);
}

const key = new PluginKey<DecorationSet>("wenyou-mention-caret");
export const editorMentionCaretPlugin = $prose(() => new Plugin<DecorationSet>({
  key,
  state: {
    init: (_, state) => mentionCaretDecorations(state.doc),
    apply: (transaction, decorations) => transaction.docChanged ? mentionCaretDecorations(transaction.doc) : decorations,
  },
  appendTransaction: (_transactions, _previous, state) => {
    const { from, to } = state.selection;
    if (!isMentionBoundary(state, from, to)) return null;
    const marks = state.storedMarks ?? state.selection.$from.marks();
    if (!marks.some((mark) => mark.type.name === "link")) return null;
    // IME 走浏览器原生组合输入，也必须从实体外侧的 marks 开始。
    return state.tr.setStoredMarks(marks.filter((mark) => mark.type.name !== "link")).setMeta("addToHistory", false);
  },
  props: {
    decorations: (state) => key.getState(state),
    handleTextInput: (view, from, to, text) => {
      if (view.composing) return false;
      const transaction = mentionBoundaryTextTransaction(view.state, from, to, text);
      if (!transaction) return false;
      view.dispatch(transaction);
      return true;
    },
  },
}));
