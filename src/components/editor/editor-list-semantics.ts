import { parserCtx, remarkStringifyOptionsCtx } from "@milkdown/core";
import { extendListItemSchemaForTask as listItemSchema } from "@milkdown/kit/preset/gfm";
import type { Ctx } from "@milkdown/kit/ctx";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { prepareMilkdownEditorMarkdown, type MarkdownValidationOptions } from "@/lib/markdown";

/** 在列表树内处理空项；不能删 HTML 后再按源码行猜测层级。 */
export function configureEditorListSerializer(ctx: Ctx) {
  ctx.update(remarkStringifyOptionsCtx, (options) => {
    const previousText = options.handlers?.text;
    const text: NonNullable<typeof options.handlers>["text"] = (node, parent, state, info) => {
      // Milkdown 对以空格结尾的文字直接透传，会把字面 "- " + mark 写成新子项。
      if (state.stack.includes("listItem") || !previousText) return state.safe(node.value, { ...info, encode: [] });
      return previousText(node, parent, state, info);
    };
    return { ...options, handlers: { ...options.handlers, text } };
  });
  ctx.update(listItemSchema.key, (previous) => (schemaCtx) => {
    const schema = previous(schemaCtx);
    return {
      ...schema,
      toMarkdown: {
        ...schema.toMarkdown,
        runner: (state, node) => {
          let needsSeparator = false;
          node.forEach((child, _offset, index) => {
            if (index > 0 && ["bullet_list", "ordered_list"].includes(child.type.name)
              && child.firstChild?.firstChild?.content.size === 0) needsSeparator = true;
          });
          state.openNode("listItem", undefined, { children: [], checked: node.attrs.checked, spread: needsSeparator || node.attrs.spread === true || node.attrs.spread === "true" });
          node.forEach((child, _offset, index) => {
            // 首空段是列表项可编辑占位，不是 HTML 空行。其他空块仍交给原协议和往返校验。
            if (index === 0 && child.type.name === "paragraph" && child.content.size === 0
              && (node.childCount === 1 || ["bullet_list", "ordered_list", "heading"].includes(node.child(1).type.name))) return;
            state.next(child);
          });
          state.closeNode();
        },
      },
    };
  });
}

function semanticNode(node: ProseNode): unknown {
  const attrs = { ...node.attrs };
  // 松紧和源码标号不是列表身份；order（起始编号）及所有正文/原子属性仍参与比较。
  if (["list_item", "bullet_list", "ordered_list"].includes(node.type.name)) {
    delete attrs.spread;
    delete attrs.label;
    delete attrs.listType;
  }
  // 标题 id 由编辑器运行时生成，不属于 Markdown 存储身份。
  if (node.type.name === "heading") delete attrs.id;
  const children: unknown[] = [];
  node.forEach((child) => children.push(semanticNode(child)));
  return { type: node.type.name, attrs, text: node.text, marks: node.marks.map((mark) => mark.toJSON()), children };
}

function listSemantics(doc: ProseNode): unknown[] {
  const lists: unknown[] = [];
  doc.descendants((node) => {
    if (!["bullet_list", "ordered_list"].includes(node.type.name)) return;
    lists.push(semanticNode(node));
    return false;
  });
  return lists;
}

/** 不仅检查项数，还核对层级、起点、空段、文字、marks 和原子身份。 */
export function preservesEditorListSemantics(ctx: Ctx, doc: ProseNode, markdown: string, options: MarkdownValidationOptions): boolean {
  const expected = listSemantics(doc);
  if (!expected.length) return true;
  const reopened = ctx.get(parserCtx)(prepareMilkdownEditorMarkdown(markdown, options));
  return JSON.stringify(listSemantics(reopened)) === JSON.stringify(expected);
}
