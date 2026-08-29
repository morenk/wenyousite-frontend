import { editorViewCtx } from "@milkdown/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type {
  DOMOutputSpec,
  Node as ProseNode,
} from "@milkdown/kit/prose/model";
import type { EditorState, Transaction } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import {
  headingAttr,
  headingIdGenerator,
  headingSchema,
  paragraphAttr,
  paragraphSchema,
} from "@milkdown/kit/preset/commonmark";
import { $prose, $remark } from "@milkdown/kit/utils";
import {
  isStoredWenyouTextAlignment,
  remarkWenyouAlignment,
  WENYOU_ALIGNMENT_ATTRIBUTE,
  type AlignmentMarkdownNode,
  type WenyouTextAlignment,
} from "@/lib/markdown-alignment";

function markdownAlignment(node: AlignmentMarkdownNode): WenyouTextAlignment {
  return isStoredWenyouTextAlignment(node.data?.wenyouAlign)
    ? node.data.wenyouAlign
    : "left";
}

function domAlignment(node: string | HTMLElement): WenyouTextAlignment {
  if (typeof node === "string") return "left";
  const value = node.getAttribute(WENYOU_ALIGNMENT_ATTRIBUTE);
  return isStoredWenyouTextAlignment(value) ? value : "left";
}

function alignmentDomAttributes(alignment: unknown): Record<string, string> {
  return isStoredWenyouTextAlignment(alignment)
    ? { [WENYOU_ALIGNMENT_ATTRIBUTE]: alignment }
    : {};
}

type MarkdownSerializerState = {
  addNode: (
    type: string,
    children?: unknown,
    value?: string,
    props?: Record<string, unknown>,
  ) => unknown;
};

function addAlignmentMarker(state: MarkdownSerializerState, node: ProseNode) {
  const alignment = node.attrs.textAlign;
  if (
    !isStoredWenyouTextAlignment(alignment)
    || !hasAlignableInlineContent(node)
    || hasRegularImage(node)
  ) return;
  const identifier = `wenyousite-align-v1-${alignment}`;
  state.addNode("definition", undefined, undefined, {
    identifier,
    label: identifier,
    title: null,
    url: "#",
  });
}

/** 原位扩展既有 schema factory，保持 paragraph 在 block group 中的默认首位。 */
export function configureEditorAlignmentSchemas(ctx: Ctx) {
  ctx.update(paragraphSchema.key, (previous) => (schemaCtx) => {
    const base = previous(schemaCtx);
    return {
      ...base,
      attrs: {
        ...base.attrs,
        textAlign: { default: "left", validate: "string" },
      },
      parseDOM: [{
        tag: "p",
        getAttrs: (node) => ({ textAlign: domAlignment(node) }),
      }],
      toDOM: (node): DOMOutputSpec => [
        "p",
        {
          ...schemaCtx.get(paragraphAttr.key)(node),
          ...alignmentDomAttributes(node.attrs.textAlign),
        },
        0,
      ],
      parseMarkdown: {
        ...base.parseMarkdown,
        runner: (state, node, type) => {
          state.openNode(type, {
            textAlign: markdownAlignment(node as unknown as AlignmentMarkdownNode),
          });
          if (node.children) state.next(node.children);
          else state.addText((node.value || "") as string);
          state.closeNode();
        },
      },
      toMarkdown: {
        ...base.toMarkdown,
        runner: (state, node) => {
          addAlignmentMarker(state as MarkdownSerializerState, node);
          base.toMarkdown.runner(state, node);
        },
      },
    };
  });

  ctx.update(headingSchema.key, (previous) => (schemaCtx) => {
    const base = previous(schemaCtx);
    const getId = schemaCtx.get(headingIdGenerator.key);
    return {
      ...base,
      attrs: {
        ...base.attrs,
        textAlign: { default: "left", validate: "string" },
      },
      parseDOM: Array.from({ length: 6 }, (_, index) => ({
        tag: `h${index + 1}`,
        getAttrs: (node: string | HTMLElement) => ({
          id: typeof node === "string" ? "" : node.id,
          level: index + 1,
          textAlign: domAlignment(node),
        }),
      })),
      toDOM: (node): DOMOutputSpec => [
        `h${node.attrs.level}`,
        {
          ...schemaCtx.get(headingAttr.key)(node),
          ...alignmentDomAttributes(node.attrs.textAlign),
          id: node.attrs.id || getId(node),
        },
        0,
      ],
      parseMarkdown: {
        ...base.parseMarkdown,
        runner: (state, node, type) => {
          state.openNode(type, {
            level: node.depth as number,
            textAlign: markdownAlignment(node as unknown as AlignmentMarkdownNode),
          });
          state.next(node.children);
          state.closeNode();
        },
      },
      toMarkdown: {
        ...base.toMarkdown,
        runner: (state, node) => {
          addAlignmentMarker(state as MarkdownSerializerState, node);
          base.toMarkdown.runner(state, node);
        },
      },
    };
  });
}

export const editorAlignmentParser = $remark(
  "wenyousite-editor-alignment",
  () => remarkWenyouAlignment,
);

function hasRegularImage(node: ProseNode): boolean {
  let found = false;
  node.descendants((child) => {
    if (child.type.name === "image" || child.type.name === "image-block") {
      found = true;
      return false;
    }
    return !found;
  });
  return found;
}

function hasAlignableInlineContent(node: ProseNode): boolean {
  let found = false;
  node.descendants((child) => {
    if (child.isText && /\S/u.test(child.text ?? "")) {
      found = true;
    } else if (
      !child.isText
      && child.isInline
      && child.isAtom
      && child.type.name !== "hardbreak"
    ) {
      found = true;
    }
    return !found;
  });
  return found;
}

function isEligibleTopLevelNode(node: ProseNode): boolean {
  if (node.type.name === "paragraph") {
    return hasAlignableInlineContent(node) && !hasRegularImage(node);
  }
  return node.type.name === "heading"
    && (node.attrs.level === 2 || node.attrs.level === 3)
    && hasAlignableInlineContent(node)
    && !hasRegularImage(node);
}

type SelectedBlock = { node: ProseNode; position: number };

function selectedTopLevelTextBlocks(state: EditorState): SelectedBlock[] {
  const { from, to, empty } = state.selection;
  const result: SelectedBlock[] = [];
  state.doc.forEach((node, position) => {
    if (node.type.name !== "paragraph" && node.type.name !== "heading") return;
    const end = position + node.nodeSize;
    const selected = empty
      ? from >= position && from <= end
      : from < end && to > position;
    if (selected) result.push({ node, position });
  });
  return result;
}

function selectedTopLevelBlocks(state: EditorState): SelectedBlock[] {
  return selectedTopLevelTextBlocks(state).filter(({ node }) => isEligibleTopLevelNode(node));
}

export function getSelectedTextAlignment(state: EditorState): WenyouTextAlignment {
  const blocks = selectedTopLevelBlocks(state);
  if (blocks.length === 0) return "left";
  const first = isStoredWenyouTextAlignment(blocks[0]!.node.attrs.textAlign)
    ? blocks[0]!.node.attrs.textAlign
    : "left";
  return blocks.every((item) => item.node.attrs.textAlign === first) ? first : "left";
}

export function cycleSelectedTextAlignment(view: EditorView): boolean {
  const blocks = selectedTopLevelBlocks(view.state);
  if (blocks.length === 0) return false;
  const current = getSelectedTextAlignment(view.state);
  const next: WenyouTextAlignment = current === "left"
    ? "center"
    : current === "center"
      ? "right"
      : "left";
  const transaction = blocks.reduce(
    (nextTransaction, { node, position }) => nextTransaction.setNodeMarkup(
      position,
      undefined,
      { ...node.attrs, textAlign: next },
    ),
    view.state.tr,
  );
  view.dispatch(transaction);
  return true;
}

/** 标题/正文互转时保留仍然合法的对齐；嵌套块交还给 Milkdown 原命令。 */
export function setSelectedEditorHeading(ctx: Ctx, level: number | null): boolean {
  const view = ctx.get(editorViewCtx);
  const blocks = selectedTopLevelTextBlocks(view.state);
  if (blocks.length === 0) return false;
  const targetType = level == null ? paragraphSchema.type(ctx) : headingSchema.type(ctx);
  const transaction = blocks.reduce((nextTransaction, { node, position }) => {
    const keepsAlignment = hasAlignableInlineContent(node)
      && !hasRegularImage(node)
      && (level == null || level === 2 || level === 3);
    const textAlign = keepsAlignment && isStoredWenyouTextAlignment(node.attrs.textAlign)
      ? node.attrs.textAlign
      : "left";
    const attrs = level == null
      ? { textAlign }
      : { id: node.attrs.id ?? "", level, textAlign };
    return nextTransaction.setNodeMarkup(position, targetType, attrs);
  }, view.state.tr);
  view.dispatch(transaction);
  view.focus();
  return true;
}

function clearInvalidAlignment(state: EditorState): Transaction | null {
  let transaction: Transaction | null = null;
  state.doc.descendants((node, position, parent) => {
    if (!isStoredWenyouTextAlignment(node.attrs.textAlign)) return true;
    const valid = parent?.type.name === "doc" && isEligibleTopLevelNode(node);
    if (valid) return true;
    transaction ??= state.tr;
    transaction.setNodeMarkup(position, undefined, {
      ...node.attrs,
      textAlign: "left",
    });
    return true;
  });
  return transaction;
}

/** 同步按钮状态，并确保粘贴/列表/引用转换不会留下协议外对齐。 */
export function createEditorAlignmentPlugin(
  onAlignmentChange: (alignment: WenyouTextAlignment) => void,
) {
  return $prose(() => new Plugin({
    key: new PluginKey("wenyousite-editor-alignment-invariant"),
    appendTransaction: (_transactions, _oldState, state) => clearInvalidAlignment(state),
    view: (view) => {
      onAlignmentChange(getSelectedTextAlignment(view.state));
      return {
        update: (nextView, previousState) => {
          if (
            nextView.state.selection.eq(previousState.selection)
            && nextView.state.doc.eq(previousState.doc)
          ) return;
          onAlignmentChange(getSelectedTextAlignment(nextView.state));
        },
      };
    },
  }));
}

export function cycleEditorAlignment(ctx: Ctx): boolean {
  const view = ctx.get(editorViewCtx);
  const changed = cycleSelectedTextAlignment(view);
  view.focus();
  return changed;
}
