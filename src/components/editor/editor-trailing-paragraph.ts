import type { Ctx } from "@milkdown/kit/ctx";
import type { Fragment, Node as ProseNode } from "@milkdown/kit/prose/model";
import type { EditorState } from "@milkdown/kit/prose/state";
import { paragraphSchema } from "@milkdown/kit/preset/commonmark";
import { trailingConfig } from "@milkdown/kit/plugin/trailing";

/** 仅编辑期来源属性，不读写 Markdown 或外部粘贴属性。 */
export const AUTO_TRAILING_PARAGRAPH = "wenyouAutoTrailing";

export function configureEditorTrailingParagraph(ctx: Ctx) {
  ctx.update(paragraphSchema.key, (previous) => (schemaCtx) => {
    const base = previous(schemaCtx);
    return { ...base, attrs: { ...base.attrs, [AUTO_TRAILING_PARAGRAPH]: { default: false, validate: "boolean" } } };
  });
  ctx.update(trailingConfig.key, (previous) => ({
    ...previous,
    getNode: (state) => {
      const node = previous.getNode(state);
      if (node.type.name !== "paragraph" || node.content.size > 0) return node;
      return node.type.create({ ...node.attrs, [AUTO_TRAILING_PARAGRAPH]: true }, node.content, node.marks);
    },
  }));
}

/** 内容编辑后将来源转为作者；追加事务进入同一历史项，撤销/重做恢复来源属性。 */
export function adoptEditedTrailingParagraphs(state: EditorState) {
  const transaction = state.tr;
  const lastPosition = state.doc.content.size - (state.doc.lastChild?.nodeSize ?? 0);
  state.doc.descendants((node, position, parent) => {
    if (node.attrs[AUTO_TRAILING_PARAGRAPH]
      && (node.content.size > 0 || parent !== state.doc || position !== lastPosition)) {
      transaction.setNodeMarkup(position, undefined, { ...node.attrs, [AUTO_TRAILING_PARAGRAPH]: false });
    }
  });
  return transaction.docChanged ? transaction : null;
}

/** 只排除来源明确、仍未使用的末尾输入占位，不删除作者空段。 */
export function withoutAutomaticTrailingParagraph(doc: ProseNode): ProseNode {
  return doc.copy(withoutAutomaticTrailingContent(doc.content));
}

export function withoutAutomaticTrailingContent(content: Fragment): Fragment {
  const last = content.lastChild;
  return last?.type.name === "paragraph" && last.attrs[AUTO_TRAILING_PARAGRAPH] && last.content.size === 0
    ? content.cut(0, content.size - last.nodeSize) : content;
}
