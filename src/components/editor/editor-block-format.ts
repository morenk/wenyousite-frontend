import { commandsCtx, editorViewCtx } from "@milkdown/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import type { Ctx } from "@milkdown/kit/ctx";
import {
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { setSelectedEditorHeading } from "./editor-alignment";

export type EditorBlockFormat = "paragraph" | "h2" | "h3" | "quote" | "bullet-list" | "ordered-list";

function emptyStandaloneFormat(node: ProseNode): EditorBlockFormat | null {
  if (node.type.name === "paragraph" && node.content.size === 0) return "paragraph";
  if (node.type.name === "heading" && node.content.size === 0) {
    return node.attrs.level === 2 ? "h2" : node.attrs.level === 3 ? "h3" : null;
  }
  if (node.childCount !== 1) return null;
  if (node.type.name === "blockquote" && emptyStandaloneFormat(node.firstChild!) === "paragraph") return "quote";
  if (["bullet_list", "ordered_list"].includes(node.type.name)) {
    const item = node.firstChild!;
    if (item.type.name === "list_item" && item.childCount === 1
      && emptyStandaloneFormat(item.firstChild!) === "paragraph") {
      return node.type.name === "bullet_list" ? "bullet-list" : "ordered-list";
    }
  }
  return null;
}

/** 工具栏、更多菜单和块格式快捷键使用同一入口。 */
export function applyEditorBlockFormat(ctx: Ctx, format: EditorBlockFormat): boolean {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const { $from, empty } = state.selection;
  const current = empty && $from.depth > 0 ? emptyStandaloneFormat($from.node(1)) : null;
  // 仅替换独立空块；复杂列表、引用的其他内容仍由现有命令处理。
  if (current) {
    const target = current === format && ["quote", "bullet-list", "ordered-list"].includes(format)
      ? "paragraph" : format;
    const { nodes } = state.schema;
    const paragraph = nodes.paragraph!.create();
    let replacement = paragraph;
    if (target === "h2" || target === "h3") {
      replacement = nodes.heading!.create({ level: target === "h2" ? 2 : 3 });
    } else if (target === "quote") {
      replacement = nodes.blockquote!.create(null, paragraph);
    } else if (target === "bullet-list" || target === "ordered-list") {
      const listType = nodes[target === "bullet-list" ? "bullet_list" : "ordered_list"]!;
      replacement = listType.create(null, nodes.list_item!.create(null, paragraph));
    }
    const start = $from.before(1);
    const transaction = state.tr.replaceWith(start, $from.after(1), replacement);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(start + 1)));
    transaction.ensureMarks(state.storedMarks ?? $from.marks());
    view.dispatch(transaction);
    view.focus();
    return true;
  }
  const commands = ctx.get(commandsCtx);
  if (format === "quote") return commands.call(wrapInBlockquoteCommand.key);
  if (format === "bullet-list") return commands.call(wrapInBulletListCommand.key);
  if (format === "ordered-list") return commands.call(wrapInOrderedListCommand.key);
  const level = format === "h2" ? 2 : format === "h3" ? 3 : null;
  return setSelectedEditorHeading(ctx, level) || commands.call(wrapInHeadingCommand.key, level ?? 0);
}
