import { TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import { getMentionUserId } from "@/lib/mention";

export function activeMentionQuery(state: EditorState) {
  const { from, empty } = state.selection;
  if (!empty) return null;
  const resolved = state.doc.resolve(from);
  const textBefore = resolved.parent.textBetween(0, resolved.parentOffset, "\n", "\n");
  const match = /(^|[\s([>])@([^\r\n@]{0,24})$/u.exec(textBefore);
  if (!match) return null;
  const range = { from: from - match[0].length + match[1].length, to: from, query: match[2] ?? "" };
  let completedMention = false;
  state.doc.nodesBetween(range.from, range.to, (node) => {
    if (node.isText && node.marks.some((mark) => mark.type.name === "link" && getMentionUserId(mark.attrs.href, node.text))) completedMention = true;
  });
  // DOM 更新和光标移动不能把刚选好的原子提及再次当成正在搜索的文字。
  return completedMention ? null : range;
}

export function userMentionTransaction(state: EditorState, range: { from: number; to: number }, username: string, href: string) {
  const link = state.schema.marks.link;
  if (!link) return null;
  const mention = state.schema.text("@" + username, [link.create({ href, title: null })]);
  const transaction = state.tr.replaceWith(range.from, range.to, mention);
  const afterMention = range.from + mention.nodeSize;
  // 分隔空格和后续输入必须在链接之外，下一次@才能有独立范围与目标。
  transaction.insert(afterMention, state.schema.text(" "));
  transaction.setSelection(TextSelection.create(transaction.doc, afterMention + 1));
  return transaction.setStoredMarks([]);
}
