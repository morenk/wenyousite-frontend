import { Plugin, PluginKey, TextSelection, AllSelection, type EditorState, type SelectionBookmark } from "@milkdown/kit/prose/state";
import { closeHistory, isHistoryTransaction } from "@milkdown/kit/prose/history";
import type { EditorView } from "@milkdown/kit/prose/view";
import { Mark, type Node } from "@milkdown/kit/prose/model";
import { $prose } from "@milkdown/kit/utils";
import { normalizeTextColor, TEXT_COLOR_MARK } from "@/lib/markdown-text-color";
import { parseMentionTarget } from "@/lib/mention";
import { parseInternalReference } from "@/lib/internal-reference";

export function isColorableText(node: Node) {
  if (!node.isText) return false;
  const link = node.marks.find((mark) => mark.type.name === "link");
  return !link || (!parseMentionTarget(link.attrs.href, node.text ?? "") && !parseInternalReference(link.attrs.href));
}

const caretColor = new PluginKey<{ color: string | null } | null>("wenyou-caret-color");
function restoreTypingColor(state: EditorState) {
  const active = caretColor.getState(state);
  const type = state.schema.marks[TEXT_COLOR_MARK];
  if (!active || !type || !state.selection.empty) return null;
  const marks = state.storedMarks ?? state.selection.$from.marks();
  const next = active.color ? type.create({ color: active.color }).addToSet(marks) : type.removeFromSet(marks);
  if (state.storedMarks && Mark.sameSet(state.storedMarks, next)) return null;
  return state.tr.setStoredMarks(next).setMeta("addToHistory", false);
}

/** 显式选色的输入模式保留到主动移动光标；输入、IME 和换段不误清除。 */
export const editorTextColorTyping = $prose(() => {
  let view: EditorView | undefined;
  let compositionEnd: ReturnType<typeof setTimeout> | undefined;
  return new Plugin({
    key: caretColor,
    state: {
      init: () => null,
      apply: (tr, active, oldState) => {
        const action = tr.getMeta(caretColor);
        if (action) return action.active;
        if (isHistoryTransaction(tr)) return null;
        // replaceAll / 草稿恢复等整篇替换不延续输入模式。
        if (tr.docChanged && tr.steps.some((step) => { const json = step.toJSON(); return json.stepType === "replace" && json.from === 0 && json.to === oldState.doc.content.size; })) return null;
        if (tr.selectionSet && !tr.docChanged && !tr.selection.eq(oldState.selection)) return null;
        return active;
      },
    },
    appendTransaction: (transactions, _old, state) => {
      // ProseMirror 收到 storedMarks 会主动结束组合输入并改写 DOM 选区，
      // 浏览器随后可能丢失 compositionend。组词期间由原生 DOM 保留颜色。
      if (view?.composing || !transactions.some((tr) => tr.docChanged)) return null;
      return restoreTypingColor(state);
    },
    props: {
      handleTextInput: (editorView, from, to, text, defaultTransaction) => {
        const { state } = editorView;
        const active = caretColor.getState(state);
        const type = state.schema.marks[TEXT_COLOR_MARK];
        if (!active || !type || !state.doc.resolve(from).parent.type.allowsMarkType(type)) return false;
        // 非 inclusive 颜色在整段候选替换时不会被 insertText 继承。
        // 只给本次输入范围补色，保留默认事务的选区/组合元数据，不设置 storedMarks。
        const transaction = defaultTransaction();
        if (active.color) transaction.addMark(from, from + text.length, type.create({ color: active.color }));
        else transaction.removeMark(from, from + text.length, type);
        editorView.dispatch(transaction);
        return true;
      },
      handleDOMEvents: {
        compositionstart: () => { clearTimeout(compositionEnd); return false; },
        compositionend: () => {
          clearTimeout(compositionEnd);
          // 等原生结束事件及最后的 DOM 事务处理完，再恢复下次输入的显式色。
          compositionEnd = setTimeout(() => {
            if (!view || view.isDestroyed || view.composing) return;
            const transaction = restoreTypingColor(view.state);
            if (transaction) view.dispatch(transaction);
          }, 0);
          return false;
        },
      },
    },
    view: (editorView) => {
      view = editorView;
      return { destroy: () => { clearTimeout(compositionEnd); view = undefined; } };
    },
  });
});

export function getEditorTextColor(state: EditorState): { enabled: boolean; color: string | null | undefined } {
  const type = state.schema.marks[TEXT_COLOR_MARK];
  if (!type || !(state.selection instanceof TextSelection || state.selection instanceof AllSelection)) return { enabled: false, color: undefined };
  if (state.selection.empty) {
    return { enabled: state.selection.$from.parent.isTextblock && state.selection.$from.parent.type.allowsMarkType(type), color: normalizeTextColor(type.isInSet(state.storedMarks ?? state.selection.$from.marks())?.attrs.color) };
  }
  const colors = new Set<string | null>();
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node, _pos, parent) => {
    if (parent?.type.allowsMarkType(type) && isColorableText(node)) colors.add(normalizeTextColor(type.isInSet(node.marks)?.attrs.color));
  });
  return { enabled: colors.size > 0, color: colors.size === 1 ? [...colors][0] : undefined };
}

export function applyEditorTextColor(view: EditorView, value: string | null, bookmark?: SelectionBookmark) {
  if (view.composing) return false;
  const color = value === null ? null : normalizeTextColor(value);
  if (value !== null && !color) return false;
  const type = view.state.schema.marks[TEXT_COLOR_MARK];
  if (!type) return false;
  let tr = view.state.tr;
  if (bookmark) tr = tr.setSelection(bookmark.resolve(tr.doc));
  const selection = tr.selection;
  if (!(selection instanceof TextSelection || selection instanceof AllSelection)) return false;
  if (selection.empty) {
    if (!selection.$from.parent.isTextblock || !selection.$from.parent.type.allowsMarkType(type)) return false;
    const marks = view.state.storedMarks ?? selection.$from.marks();
    tr.setStoredMarks(color ? type.create({ color }).addToSet(marks) : type.removeFromSet(marks));
    tr.setMeta(caretColor, { active: { color } }).setMeta("addToHistory", false);
  } else {
    let eligible = false;
    tr.doc.nodesBetween(selection.from, selection.to, (node, position, parent) => {
      if (!parent?.type.allowsMarkType(type) || !isColorableText(node)) return;
      eligible = true;
      const from = Math.max(selection.from, position);
      const to = Math.min(selection.to, position + node.nodeSize);
      if (color) tr.addMark(from, to, type.create({ color }));
      else tr.removeMark(from, to, type);
    });
    if (!eligible) return false;
    tr.setMeta(caretColor, { active: null }).setStoredMarks(null);
    tr = closeHistory(tr);
  }
  view.dispatch(tr);
  if (!selection.empty) view.dispatch(closeHistory(view.state.tr).setMeta("addToHistory", false));
  view.focus();
  return true;
}

/** 运行时关闭新写入口时结束显式输入色，不改正文已有 marks。 */
export function clearEditorTextColorTyping(view: EditorView) {
  if (!caretColor.getState(view.state)) return;
  const type = view.state.schema.marks[TEXT_COLOR_MARK];
  const marks = view.state.storedMarks ?? view.state.selection.$from.marks();
  view.dispatch(view.state.tr.setStoredMarks(type ? type.removeFromSet(marks) : marks).setMeta(caretColor, { active: null }).setMeta("addToHistory", false));
}
