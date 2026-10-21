import { normalizeTextColor, TEXT_COLOR_MARK } from "@/lib/markdown-text-color";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { parseMentionTarget } from "@/lib/mention";
import { parseInternalReference } from "@/lib/internal-reference";
import { $prose, $markSchema } from "@milkdown/kit/utils";
import { normalizeTextFont, readTextFont, textFontAttribute, textFontFamily, TEXT_FONT_SELECTOR, TEXT_FONT_MARK } from "@/lib/markdown-text-font";
import type { Ctx } from "@milkdown/kit/ctx";

export function configureEditorTextFontRendering(ctx: Ctx, enabled: boolean) {
  if (enabled) return;
  ctx.update(editorTextFontSchema.key, previous => schemaCtx => ({
    ...previous(schemaCtx),
    toDOM: () => ["span", {}, 0],
  }));
}

/** 字体标记共用保源与取色；DOM 只接受受控属性，不从 style 读取字体。 */
export const editorTextFontSchema = $markSchema(TEXT_FONT_MARK, () => ({
  attrs: { fontId: { default: null } },
  inclusive: false,
  parseDOM: [{
    tag: TEXT_FONT_SELECTOR.split(", ").map(selector => "span" + selector).join(", "),
    consuming: false,
    getAttrs: (element: HTMLElement) => {
      const fontId = readTextFont(element);
      return fontId ? { fontId } : false;
    },
  }],
  toDOM: (mark) => {
    const fontId = normalizeTextFont(mark.attrs.fontId);
    return ["span", fontId ? { [textFontAttribute(fontId)]: fontId, style: "font-family: " + textFontFamily(fontId) } : {}, 0];
  },
  parseMarkdown: {
    match: (node) => node.type === TEXT_FONT_MARK,
    runner: (state, node, type) => {
      const fontId = normalizeTextFont(node.fontId);
      if (!fontId) return;
      state.openMark(type, { fontId });
      const color = normalizeTextColor(node.color);
      const colorType = state.schema.marks[TEXT_COLOR_MARK];
      if (color && colorType) state.openMark(colorType, { color });
      state.next(node.children);
      if (color && colorType) state.closeMark(colorType);
      state.closeMark(type);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === TEXT_FONT_MARK,
    runner: (state, mark) => {
      state.withMark(mark, TEXT_FONT_MARK, undefined, { fontId: normalizeTextFont(mark.attrs.fontId) });
    },
  },
  priority: 1,
}));

/** 在彩色文字中插入换行或原子内容时，只移除新原子范围上的字体。 */
export const editorTextFontAtomicPolicy = $prose(() => new Plugin({
  key: new PluginKey("wenyou-text-font-atoms"),
  appendTransaction: (transactions, _oldState, state) => {
    if (!transactions.some((transaction) => transaction.docChanged)) return null;
    const fontId = state.schema.marks[TEXT_FONT_MARK];
    if (!fontId) return null;
    const transaction = state.tr;
    state.doc.descendants((node, position) => {
      if (!node.marks.some((mark) => mark.type === fontId)) return;
      if (!node.isText) {
        if (node.isAtom) transaction.removeMark(position, position + node.nodeSize, fontId);
        return;
      }
      const text = node.text ?? "";
      const link = node.marks.find((mark) => mark.type.name === "link");
      if (link && (parseMentionTarget(link.attrs.href, text) || parseInternalReference(link.attrs.href))) {
        transaction.removeMark(position, position + node.nodeSize, fontId);
        return;
      }

    });
    return transaction.steps.length ? transaction : null;
  },
}));
