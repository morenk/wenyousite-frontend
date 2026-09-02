import { editorViewCtx, remarkPluginsCtx } from "@milkdown/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type {
  DOMOutputSpec,
  Node as ProseNode,
} from "@milkdown/kit/prose/model";
import type { EditorState, Transaction } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { imageBlockSchema } from "@milkdown/kit/component/image-block";
import {
  headingAttr,
  headingIdGenerator,
  headingSchema,
  paragraphAttr,
  paragraphSchema,
} from "@milkdown/kit/preset/commonmark";
import { $prose } from "@milkdown/kit/utils";
import {
  isStoredWenyouTextAlignment,
  remarkWenyouAlignment,
  WENYOU_ALIGNMENT_ATTRIBUTE,
  type AlignmentMarkdownNode,
  type MarkdownAlignmentOptions,
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

const EDITOR_ALIGNMENT_MARKER_RE = /^wenyousite-align-v1-(center|right)$/u;

function getEditorMarkerAlignment(
  node: AlignmentMarkdownNode,
): WenyouTextAlignment | null {
  if (node.type !== "definition" || node.url !== "#" || node.title != null) return null;
  const identifier = typeof node.identifier === "string"
    ? node.identifier
    : typeof node.label === "string"
      ? node.label
      : "";
  const alignment = identifier.match(EDITOR_ALIGNMENT_MARKER_RE)?.[1];
  return alignment === "center" || alignment === "right" ? alignment : null;
}

function isAdjacentEditorMarker(
  marker: AlignmentMarkdownNode,
  target: AlignmentMarkdownNode,
): boolean {
  const markerLine = marker.position?.end?.line;
  const targetLine = target.position?.start?.line;
  return markerLine === undefined || targetLine === undefined || targetLine === markerLine + 1;
}

function addAlignmentMarker(
  state: MarkdownSerializerState,
  node: ProseNode,
  imageAlignmentEnabled = false,
) {
  const alignment = node.attrs.textAlign;
  if (!isStoredWenyouTextAlignment(alignment)) return;
  const imageBlock = node.type?.name === "image-block";
  if (imageBlock && !imageAlignmentEnabled) return;
  if (!imageBlock && (!hasAlignableInlineContent(node) || hasRegularImage(node))) return;
  const identifier = `wenyousite-align-v1-${alignment}`;
  state.addNode("definition", undefined, undefined, {
    identifier,
    label: identifier,
    title: null,
    url: "#",
  });
}

/** 原位扩展既有 schema factory，保持 paragraph 在 block group 中的默认首位。 */
export function configureEditorAlignmentSchemas(
  ctx: Ctx,
  options: MarkdownAlignmentOptions = {},
) {
  const imageAlignmentEnabled =
    (options.markdownContractVersion ?? 0) >= 5;
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

  try {
    ctx.update(imageBlockSchema.key, (previous) => (schemaCtx) => {
      const base = previous(schemaCtx);
      return {
        ...base,
        attrs: {
          ...base.attrs,
          textAlign: { default: "left", validate: "string" },
        },
        parseDOM: [{
          tag: 'img[data-type="image-block"]',
          getAttrs: (node) => {
            if (typeof node === "string") {
              return { textAlign: "left" };
            }
            const ratio = Number(node.getAttribute("ratio") ?? "1");
            return {
              src: node.getAttribute("src") ?? "",
              caption: node.getAttribute("caption") ?? "",
              ratio: Number.isFinite(ratio) && ratio !== 0 ? ratio : 1,
              textAlign: imageAlignmentEnabled ? domAlignment(node) : "left",
            };
          },
        }],
        toDOM: (node): DOMOutputSpec => {
          const attrs = Object.fromEntries(
            Object.entries(node.attrs).filter(([key]) => key !== "textAlign"),
          );
          return [
            "img",
            {
              "data-type": "image-block",
              ...attrs,
              ...alignmentDomAttributes(
                imageAlignmentEnabled ? node.attrs.textAlign : "left",
              ),
            },
          ];
        },
        parseMarkdown: {
          ...base.parseMarkdown,
          runner: (state, node, type) => {
            const ratio = Number(node.alt || 1);
            state.addNode(type, {
              src: node.url,
              caption: node.title,
              ratio: Number.isFinite(ratio) && ratio !== 0 ? ratio : 1,
              textAlign: imageAlignmentEnabled
                ? markdownAlignment(node as unknown as AlignmentMarkdownNode)
                : "left",
            });
          },
        },
        toMarkdown: {
          ...base.toMarkdown,
          runner: (state, node) => {
            addAlignmentMarker(state as MarkdownSerializerState, node, imageAlignmentEnabled);
            base.toMarkdown.runner(state, node);
          },
        },
      };
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "contextNotFound") throw error;
  }
}

/**
 * 在 ConfigReady 阶段注册转换器，确保 core schema 快照 remarkPluginsCtx 前已就绪。
 * Crepe 先装载 commonmark；事后追加 `$remark` 会与 schema 初始化竞争并偶发丢失对齐元数据。
 */
export function configureEditorAlignmentParser(
  ctx: Ctx,
  options: MarkdownAlignmentOptions = {},
) {
  ctx.update(remarkPluginsCtx, (plugins) => [
    ...plugins,
    { plugin: editorAlignmentRemarkPlugin, options },
  ]);
}

/** 编辑器先把独立图片段落固定成 image-block，再绑定对齐，避免 Crepe 替换段落时丢失元数据。 */
function editorAlignmentRemarkPlugin(options: MarkdownAlignmentOptions = {}) {
  const markdownContractVersion = options.markdownContractVersion ?? 0;
  const imageAlignmentEnabled = markdownContractVersion >= 5;
  const transformAlignment = remarkWenyouAlignment(options);
  return (treeValue: unknown) => {
    if (imageAlignmentEnabled) {
      const tree = treeValue as AlignmentMarkdownNode;
      for (let index = 0; index < (tree.children?.length ?? 0) - 1; index++) {
        const marker = tree.children?.[index];
        const target = tree.children?.[index + 1];
        if (
          !marker
          || !target
          || !getEditorMarkerAlignment(marker)
          || !isAdjacentEditorMarker(marker, target)
          || target.type !== "paragraph"
          || target.children?.length !== 1
        ) continue;
        const image = target.children[0];
        if (
          image?.type !== "image"
          || String(image.title ?? "").startsWith("wenyousite-sticker:v1:")
        ) continue;
        target.type = "image-block";
        target.url = image.url;
        target.alt = image.alt;
        target.title = image.title;
        delete target.children;
      }
    }
    transformAlignment(treeValue);
  };
}

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

function isEligibleTopLevelNode(
  node: ProseNode,
  imageAlignmentEnabled = false,
): boolean {
  if (node.type.name === "image-block") return imageAlignmentEnabled;
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
  return selectedTopLevelBlocksByKind(state, false);
}

function selectedTopLevelBlocksByKind(
  state: EditorState,
  includeImageBlocks: boolean,
): SelectedBlock[] {
  const { from, to, empty } = state.selection;
  const result: SelectedBlock[] = [];
  state.doc.forEach((node, position) => {
    if (
      node.type.name !== "paragraph"
      && node.type.name !== "heading"
      && (!includeImageBlocks || node.type.name !== "image-block")
    ) return;
    const end = position + node.nodeSize;
    const selected = empty
      ? from >= position && from <= end
      : from < end && to > position;
    if (selected) result.push({ node, position });
  });
  return result;
}

function selectedTopLevelBlocks(
  state: EditorState,
  imageAlignmentEnabled = false,
): SelectedBlock[] {
  return selectedTopLevelBlocksByKind(state, imageAlignmentEnabled).filter(({ node }) =>
    isEligibleTopLevelNode(node, imageAlignmentEnabled),
  );
}

export function getSelectedTextAlignment(
  state: EditorState,
  imageAlignmentEnabled = false,
): WenyouTextAlignment {
  const blocks = selectedTopLevelBlocks(state, imageAlignmentEnabled);
  if (blocks.length === 0) return "left";
  const first = isStoredWenyouTextAlignment(blocks[0]!.node.attrs.textAlign)
    ? blocks[0]!.node.attrs.textAlign
    : "left";
  return blocks.every((item) => item.node.attrs.textAlign === first) ? first : "left";
}

export function cycleSelectedTextAlignment(
  view: EditorView,
  imageAlignmentEnabled = false,
): boolean {
  const current = getSelectedTextAlignment(view.state, imageAlignmentEnabled);
  const next: WenyouTextAlignment = current === "left"
    ? "center"
    : current === "center"
      ? "right"
      : "left";
  return setSelectedTextAlignment(view, next, imageAlignmentEnabled);
}

export function setSelectedTextAlignment(
  view: EditorView,
  alignment: WenyouTextAlignment,
  imageAlignmentEnabled = false,
): boolean {
  const blocks = selectedTopLevelBlocks(view.state, imageAlignmentEnabled);
  if (blocks.length === 0) return false;
  const changedBlocks = blocks.filter(({ node }) => node.attrs.textAlign !== alignment);
  if (changedBlocks.length === 0) return true;
  const transaction = changedBlocks.reduce(
    (nextTransaction, { node, position }) => nextTransaction.setNodeMarkup(
      position,
      undefined,
      { ...node.attrs, textAlign: alignment },
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

function clearInvalidAlignment(
  state: EditorState,
  imageAlignmentEnabled = false,
): Transaction | null {
  let transaction: Transaction | null = null;
  state.doc.descendants((node, position, parent) => {
    if (!isStoredWenyouTextAlignment(node.attrs.textAlign)) return true;
    const valid = parent?.type.name === "doc"
      && isEligibleTopLevelNode(node, imageAlignmentEnabled);
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

/** Crepe 的 image-block 使用 NodeView，需把模型对齐同步到可见外层容器。 */
function syncImageBlockDomAlignment(view: EditorView, imageAlignmentEnabled: boolean) {
  view.state.doc.forEach((node, position) => {
    if (node.type.name !== "image-block") return;
    const dom = view.nodeDOM(position);
    if (!(dom instanceof HTMLElement)) return;
    if (imageAlignmentEnabled && isStoredWenyouTextAlignment(node.attrs.textAlign)) {
      dom.setAttribute(WENYOU_ALIGNMENT_ATTRIBUTE, node.attrs.textAlign);
    } else {
      dom.removeAttribute(WENYOU_ALIGNMENT_ATTRIBUTE);
    }
  });
}

/** 同步按钮状态，并确保粘贴/列表/引用转换不会留下协议外对齐。 */
export function createEditorAlignmentPlugin(
  onAlignmentChange: (alignment: WenyouTextAlignment) => void,
  imageAlignmentEnabled: () => boolean = () => false,
) {
  return $prose(() => new Plugin({
    key: new PluginKey("wenyousite-editor-alignment-invariant"),
    appendTransaction: (_transactions, _oldState, state) =>
      clearInvalidAlignment(state, imageAlignmentEnabled()),
    view: (view) => {
      syncImageBlockDomAlignment(view, imageAlignmentEnabled());
      onAlignmentChange(getSelectedTextAlignment(view.state, imageAlignmentEnabled()));
      return {
        update: (nextView, previousState) => {
          syncImageBlockDomAlignment(nextView, imageAlignmentEnabled());
          if (
            nextView.state.selection.eq(previousState.selection)
            && nextView.state.doc.eq(previousState.doc)
          ) return;
          onAlignmentChange(
            getSelectedTextAlignment(nextView.state, imageAlignmentEnabled()),
          );
        },
      };
    },
  }));
}

export function cycleEditorAlignment(ctx: Ctx, imageAlignmentEnabled = false): boolean {
  const view = ctx.get(editorViewCtx);
  const changed = cycleSelectedTextAlignment(view, imageAlignmentEnabled);
  view.focus();
  return changed;
}

export function setEditorAlignment(
  ctx: Ctx,
  alignment: WenyouTextAlignment,
  imageAlignmentEnabled = false,
): boolean {
  const view = ctx.get(editorViewCtx);
  const changed = setSelectedTextAlignment(view, alignment, imageAlignmentEnabled);
  view.focus();
  return changed;
}
