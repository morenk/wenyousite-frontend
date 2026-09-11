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
  // 未设置对齐与显式 left 具有相同语义，空段转换时可能采用不同默认值。
  if ("textAlign" in attrs) attrs.textAlign ||= "left";
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
  return { type: node.type.name, attrs, text: node.text, marks: [...node.marks].sort((a, b) => a.type.name.localeCompare(b.type.name)).map((mark) => mark.toJSON()), children };
}

function documentStructure(node: ProseNode): unknown {
  // 列表沿用完整文字、marks、原子身份检查。其他块复用既有行内规范化，核对排版结构。
  if (["bullet_list", "ordered_list"].includes(node.type.name)) return semanticNode(node);
  const children: unknown[] = [];
  if (!node.isTextblock) node.forEach(child => children.push(documentStructure(child)));
  let breaks = 0;
  if (node.isTextblock) node.forEach(child => { if (child.type.name === "hardbreak") breaks++; });
  return { type: node.type.name, level: node.attrs.level, alignment: node.attrs.textAlign || "left",
    ...(node.isTextblock ? { empty: node.content.size === 0, breaks } : { children }) };
}

/** 整篇块顺序、作者空段和换行都参与比较，不把行内规范写法的差异当作空块丢失。 */
export function preservesEditorDocumentSemantics(ctx: Ctx, doc: ProseNode, markdown: string, options: MarkdownValidationOptions): boolean {
  const reopened = ctx.get(parserCtx)(prepareMilkdownEditorMarkdown(markdown, options));
  return JSON.stringify(documentStructure(reopened)) === JSON.stringify(documentStructure(doc));
}
