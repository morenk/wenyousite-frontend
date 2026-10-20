import { Plugin, PluginKey, TextSelection, AllSelection, type EditorState, type SelectionBookmark } from "@milkdown/kit/prose/state";
import { closeHistory, isHistoryTransaction } from "@milkdown/kit/prose/history";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node } from "@milkdown/kit/prose/model";
import { $prose } from "@milkdown/kit/utils";
import { normalizeTextFont, TEXT_FONT_MARK } from "@/lib/markdown-text-font";
import { parseMentionTarget } from "@/lib/mention";
import { parseInternalReference } from "@/lib/internal-reference";

export function isFontableText(node: Node) {
  if (!node.isText) return false;
  const link = node.marks.find((mark) => mark.type.name === "link");
  return !link || (!parseMentionTarget(link.attrs.href, node.text ?? "") && !parseInternalReference(link.attrs.href));
}

const caretFont = new PluginKey<{ fontId: string | null } | null>("wenyou-caret-font");
/** 显式选字体的输入模式保留到主动移动光标；输入、IME 和换段不误清除。 */
export const editorTextFontTyping = $prose(() => new Plugin({
  key: caretFont,
  state: {
    init: () => null,
    apply: (tr, active, oldState) => {
      const action = tr.getMeta(caretFont);
      if (action) return action.active;
      if (isHistoryTransaction(tr)) return null;
      // replaceAll / 草稿恢复等整篇替换不延续输入模式。
      if (tr.docChanged && tr.steps.some((step) => { const json = step.toJSON(); return json.stepType === "replace" && json.from === 0 && json.to === oldState.doc.content.size; })) return null;
      if (tr.selectionSet && !tr.docChanged && !tr.selection.eq(oldState.selection)) return null;
      return active;
    },
  },
  appendTransaction: (transactions, _old, state) => {
    const active = caretFont.getState(state);
    const type = state.schema.marks[TEXT_FONT_MARK];
    if (!active || !type || !state.selection.empty || !transactions.some((tr) => tr.docChanged)) return null;
    const marks = state.storedMarks ?? state.selection.$from.marks();
    const next = active.fontId ? type.create({ fontId: active.fontId }).addToSet(marks) : type.removeFromSet(marks);
    return state.tr.setStoredMarks(next).setMeta("addToHistory", false);
  },
}));

export function getEditorTextFont(state: EditorState): { enabled: boolean; fontId: string | null | undefined } {
  const type = state.schema.marks[TEXT_FONT_MARK];
  if (!type || !(state.selection instanceof TextSelection || state.selection instanceof AllSelection)) return { enabled: false, fontId: undefined };
  if (state.selection.empty) {
    return { enabled: state.selection.$from.parent.isTextblock && state.selection.$from.parent.type.allowsMarkType(type), fontId: normalizeTextFont(type.isInSet(state.storedMarks ?? state.selection.$from.marks())?.attrs.fontId) };
  }
  const fonts = new Set<string | null>();
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node, _pos, parent) => {
    if (parent?.type.allowsMarkType(type) && isFontableText(node)) fonts.add(normalizeTextFont(type.isInSet(node.marks)?.attrs.fontId));
  });
  return { enabled: fonts.size > 0, fontId: fonts.size === 1 ? [...fonts][0] : undefined };
}

export function applyEditorTextFont(view: EditorView, value: string | null, bookmark?: SelectionBookmark) {
  const fontId = value === null ? null : normalizeTextFont(value);
  if (value !== null && !fontId) return false;
  const type = view.state.schema.marks[TEXT_FONT_MARK];
  if (!type) return false;
  let tr = view.state.tr;
  if (bookmark) tr = tr.setSelection(bookmark.resolve(tr.doc));
  const selection = tr.selection;
  if (!(selection instanceof TextSelection || selection instanceof AllSelection)) return false;
  if (selection.empty) {
    if (!selection.$from.parent.isTextblock || !selection.$from.parent.type.allowsMarkType(type)) return false;
    const marks = view.state.storedMarks ?? selection.$from.marks();
    tr.setStoredMarks(fontId ? type.create({ fontId }).addToSet(marks) : type.removeFromSet(marks));
    tr.setMeta(caretFont, { active: { fontId } }).setMeta("addToHistory", false);
  } else {
    let eligible = false;
    tr.doc.nodesBetween(selection.from, selection.to, (node, position, parent) => {
      if (!parent?.type.allowsMarkType(type) || !isFontableText(node)) return;
      eligible = true;
      const from = Math.max(selection.from, position);
      const to = Math.min(selection.to, position + node.nodeSize);
      if (fontId) tr.addMark(from, to, type.create({ fontId }));
      else tr.removeMark(from, to, type);
    });
    if (!eligible) return false;
    tr.setMeta(caretFont, { active: null }).setStoredMarks(null);
    tr = closeHistory(tr);
  }
  view.dispatch(tr);
  if (!selection.empty) view.dispatch(closeHistory(view.state.tr).setMeta("addToHistory", false));
  view.focus();
  return true;
}

/** 运行时关闭新写入口时结束显式输入字体，不改正文已有 marks。 */
export function clearEditorTextFontTyping(view: EditorView) {
  if (!caretFont.getState(view.state)) return;
  const type = view.state.schema.marks[TEXT_FONT_MARK];
  const marks = view.state.storedMarks ?? view.state.selection.$from.marks();
  view.dispatch(view.state.tr.setStoredMarks(type ? type.removeFromSet(marks) : marks).setMeta(caretFont, { active: null }).setMeta("addToHistory", false));
}
