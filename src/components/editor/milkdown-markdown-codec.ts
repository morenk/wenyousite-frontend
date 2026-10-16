import type { Unsafe } from "mdast-util-to-markdown";
import { hoistTextColors, normalizeTextColor, remarkTextColor, TEXT_COLOR_MARK } from "@/lib/markdown-text-color";
import {
  remarkStringifyOptionsCtx,
  remarkPluginsCtx,
  serializerCtx,
  parserCtx,
} from "@milkdown/core";
import { linkSchema, paragraphAttr, textSchema } from "@milkdown/kit/preset/commonmark";
import type { Ctx } from "@milkdown/kit/ctx";
import { Fragment, type Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $node, $prose, $remark } from "@milkdown/kit/utils";
import {
  findUnsupportedMarkdownFormats,
  prepareMilkdownEditorMarkdown,
  sanitizeEmptyImages,
  type MarkdownValidationOptions,
} from "@/lib/markdown";
import { parseInlineMentionNodes, parseMentionTarget } from "@/lib/mention";
import { remarkCanonicalMentions } from "@/lib/markdown-mention";
import { serializeInlineDiceNode } from "@/lib/dice-inline";
import { remarkRecoverAttentionBoundaries } from "@/lib/markdown-attention";
import { normalizeSerializedAlignmentMarkers } from "@/lib/markdown-alignment";

import { canonicalizeEditorEmptyRows, documentWithExplicitEmptyRows, handlePlainNewline } from "./editor-plain-newline";
import { adoptEditedTrailingParagraphs, configureEditorTrailingParagraph, withoutAutomaticTrailingParagraph } from "./editor-trailing-paragraph";

declare module "mdast-util-to-markdown" {
  interface ConstructNameMap {
    wenyouTextColor: "wenyouTextColor";
  }
}

type DiceMarkdownNode = {
  nodeId?: unknown;
  notation?: unknown;
};

type EditorMarkdownNode = {
  type?: string;
  value?: string;
  url?: string;
  color?: string;
  data?: Record<string, unknown>;
  children?: EditorMarkdownNode[];
};

type SerializerInfo = Record<string, unknown> & {
  before: string;
  after: string;
};

type SerializerTracker = {
  move: (value: string) => string;
  current: () => Record<string, unknown>;
};

type SerializerState = {
  attentionEncodeSurroundingInfo: { before: boolean; after: boolean } | undefined;
  containerPhrasing: (node: EditorMarkdownNode, info: SerializerInfo) => string;
  createTracker: (info: SerializerInfo) => SerializerTracker;
  enter: (name: string) => () => void;
  safe: (value: string, info: Record<string, unknown>) => string;
};

type MarkdownHandler = ((
  node: unknown,
  parent: unknown,
  state: unknown,
  info: unknown,
) => string) & {
  peek?: (...args: unknown[]) => string;
};

type EncodeSides = {
  inside: boolean;
  outside: boolean;
};

export interface EditorMarkdownBridgeOptions {
  onChange: (markdown: string) => void;
  /** 即时轻量通知；不在按键路径编码正文。 */
  onDocumentChange?: () => void;
  onCompositionChange?: (composing: boolean) => void;
  onError?: (error: unknown) => void;
  onSyncErrorChange?: (hasError: boolean) => void;
  onValid?: () => void;
  onReady?: (flush: (() => string | null) | null) => void;
  markdownContractVersion?: number;
  textColorVersion?: 1;
}

export class EditorMarkdownCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorMarkdownCodecError";
  }
}

/** 原始正文只在进入编辑器时执行历史兼容与字面降级。 */
export function prepareEditorMarkdown(
  markdown: string,
  options: MarkdownValidationOptions = {},
): string {
  return prepareMilkdownEditorMarkdown(markdown, options);
}

/** 产品阅读态保留普通 LF；回填编辑器时也恢复成可见换行，而不是折叠为空格。 */
export const editorSoftBreakParser = $remark(
  "wenyousite-editor-soft-break",
  () => () => (tree) => {
    const visit = (node: EditorMarkdownNode) => {
      if (node.type === "break" && node.data?.isInline === true) {
        node.data = { ...node.data, isInline: false };
      }
      // CommonMark 行内代码中的源码 LF 在阅读态为空格，编辑回填遵循相同语义。
      if (node.type === "inlineCode" && node.value?.includes("\n")) {
        node.value = node.value.replace(/\r\n?|\n/gu, " ");
      }
      node.children?.forEach(visit);
    };
    visit(tree as unknown as EditorMarkdownNode);
  },
);

/** 阅读态与编辑态共用同一份标点/符号边界恢复规则。 */
export const editorAttentionBoundaryParser = $remark(
  "wenyousite-editor-attention-boundary",
  () => remarkRecoverAttentionBoundaries,
);

/** 私有中间 AST 节点：阻止 Milkdown 在关闭 marks 时丢失已确认应保留的边界空白。 */
export const editorBoundaryTextSchema = $node("text", () => ({
  ...textSchema.schema,
  toMarkdown: {
    ...textSchema.schema.toMarkdown,
    runner: (state, node) => {
      const protectedBoundary = node.marks.length > 0 && /^\p{White_Space}|\p{White_Space}$/u.test(node.text ?? "");
      state.addNode(protectedBoundary ? "wenyouBoundaryText" : "text", undefined, node.text);
    },
  },
}));

function classifyAttentionCharacter(value: string): "word" | "whitespace" | "punctuation" {
  if (!value || /[\s\p{Z}]/u.test(value)) return "whitespace";
  return /[\p{P}\p{S}]/u.test(value) ? "punctuation" : "word";
}

/** GFM `~` 的开闭规则与星号 attention 相同。 */
function getAttentionEncodeSides(
  outside: string,
  inside: string,
  marker: "*" | "_" | "~",
): EncodeSides {
  const outsideKind = classifyAttentionCharacter(outside);
  const insideKind = classifyAttentionCharacter(inside);
  if (outsideKind === "word") {
    if (insideKind === "word") {
      return marker === "_"
        ? { inside: true, outside: true }
        : { inside: false, outside: false };
    }
    if (insideKind === "whitespace") return { inside: true, outside: true };
    return { inside: false, outside: true };
  }
  if (outsideKind === "whitespace") {
    if (insideKind === "word") return { inside: false, outside: false };
    if (insideKind === "whitespace") return { inside: true, outside: true };
    return { inside: false, outside: false };
  }
  if (insideKind === "whitespace") return { inside: true, outside: false };
  return { inside: false, outside: false };
}

function firstCodePoint(value: string): string {
  return Array.from(value)[0] ?? "";
}

function lastCodePoint(value: string): string {
  return Array.from(value).at(-1) ?? "";
}

function encodeCharacterReference(value: string): string {
  const codePoint = value.codePointAt(0);
  return codePoint === undefined ? value : `&#x${codePoint.toString(16).toUpperCase()};`;
}

function encodeFirstCodePoint(value: string): string {
  const first = firstCodePoint(value);
  return first ? `${encodeCharacterReference(first)}${value.slice(first.length)}` : value;
}

function encodeLastCodePoint(value: string): string {
  const last = lastCodePoint(value);
  return last ? `${value.slice(0, -last.length)}${encodeCharacterReference(last)}` : value;
}

/** Milkdown 自带 mark handlers 未转发 attention 邻接保护；补齐标准 mdast 行为。 */
function createSafeAttentionMarkdownHandler(
  construct: "strong" | "emphasis" | "strikethrough",
  repetitions: 1 | 2,
): MarkdownHandler {
  const fallbackMarker = construct === "strikethrough" ? "~" : "*";
  // 代码的反引号和邻接粗体会使星号游程产生歧义；peek 必须使用相同选择。
  const shouldUseUnderscore = (node: EditorMarkdownNode & { marker?: unknown }, parent: EditorMarkdownNode) => {
    const siblings = parent?.children ?? [];
    const index = siblings.indexOf(node);
    return node.marker === "_" || (construct === "emphasis" && (
      node.children?.some((child) => child.type === "inlineCode")
      || siblings[index - 1]?.type === "strong"
      || siblings[index + 1]?.type === "strong"
    ));
  };
  const handler: MarkdownHandler = (nodeValue, _parent, stateValue, infoValue) => {
    const node = nodeValue as EditorMarkdownNode & { marker?: unknown };
    const state = stateValue as SerializerState;
    const info = infoValue as SerializerInfo;
    const marker = construct === "strikethrough"
      ? "~"
      : shouldUseUnderscore(node, _parent as EditorMarkdownNode)
        ? "_"
        : "*";
    const delimiter = marker.repeat(repetitions);
    const exit = state.enter(construct);
    const tracker = state.createTracker(info);
    const before = tracker.move(delimiter);
    const between = tracker.move(state.containerPhrasing(node, {
      after: marker,
      before,
      ...tracker.current(),
    } as SerializerInfo));

    let content = between;

    const open = getAttentionEncodeSides(
      lastCodePoint(info.before),
      firstCodePoint(content),
      marker,
    );
    if (open.inside) content = encodeFirstCodePoint(content);

    const close = getAttentionEncodeSides(
      firstCodePoint(info.after),
      lastCodePoint(content),
      marker,
    );
    if (close.inside) content = encodeLastCodePoint(content);
    const after = tracker.move(delimiter);
    exit();

    state.attentionEncodeSurroundingInfo = {
      before: open.outside,
      after: close.outside,
    };
    return `${before}${content}${after}`;
  };
  handler.peek = (nodeValue, parent) => {
    const node = nodeValue as EditorMarkdownNode & { marker?: unknown };
    return construct !== "strikethrough" && shouldUseUnderscore(node, parent as EditorMarkdownNode) ? "_" : fallbackMarker;
  };
  return handler;
}

const safeStrongMarkdownHandler = createSafeAttentionMarkdownHandler("strong", 2);
const safeEmphasisMarkdownHandler = createSafeAttentionMarkdownHandler("emphasis", 1);
const safeDeleteMarkdownHandler = createSafeAttentionMarkdownHandler("strikethrough", 2);
const INLINE_FORMAT_MARK_NAMES = new Set([
  "strong",
  "emphasis",
  "strikethrough",
  "strike_through",
]);

function serializeDiceMarkdownNode(node: DiceMarkdownNode): string {
  if (typeof node.nodeId !== "string" || typeof node.notation !== "string") {
    throw new EditorMarkdownCodecError("骰子节点缺少稳定身份或表达式");
  }
  return serializeInlineDiceNode({ nodeId: node.nodeId, notation: node.notation });
}

function remarkStandaloneSourceLinks() {
  return (root: unknown) => {
    const tree = root as EditorMarkdownNode;
    // 只有原本相邻的独立同 URL 链接需要边界身份；普通分片仍共享同一个 link mark。
    const visit = (node: EditorMarkdownNode) => {
      const children = node.children ?? [];
      children.forEach((child, index) => {
        if (child.type === "link" && [children[index - 1], children[index + 1]].some((other) => other?.type === "link" && other.url === child.url)) {
          child.data = { ...child.data, wenyouSourceLinkBoundary: index + 1 };
        }
        visit(child);
      });
    };
    visit(tree);
    for (const paragraph of tree.children ?? []) {
      const link = paragraph.children?.[0];
      if (paragraph.type === "paragraph" && paragraph.children?.length === 1 && link?.type === "link") {
        link.data = { ...link.data, wenyouStandaloneLink: true };
      }
    }
  };
}

/** Milkdown 按 marks 顺序拆开的同一原始链接重新包住 label；边界身份不同则不合并。 */
function standaloneSourceLinkParagraph(paragraph: EditorMarkdownNode): EditorMarkdownNode {
  let source: EditorMarkdownNode | undefined;
  let valid = true;
  const unwrap = (node: EditorMarkdownNode): EditorMarkdownNode[] => {
    if (node.type === "link" && node.data?.wenyouStandaloneLink === true) {
      if (source && (source.url !== node.url || source.data?.wenyouSourceLinkBoundary !== node.data.wenyouSourceLinkBoundary)) valid = false;
      source ??= node;
      return node.children ?? [];
    }
    if (["strong", "emphasis", "delete"].includes(node.type ?? "") && node.children) {
      return [{ ...node, children: node.children.flatMap(unwrap) }];
    }
    valid = false;
    return [node];
  };
  const children = paragraph.children?.flatMap(unwrap) ?? [];
  return valid && source ? { ...paragraph, children: [{ ...source, children }] } : paragraph;
}

/**
 * 编辑器结构的 Markdown 写出规则。
 * Shift+Enter 在 ProseMirror 中仍是 break 节点，但存储协议把它写成普通 LF，
 * 避免 remark-stringify 生成反斜杠硬换行后再被发布净化器破坏。
 */
export function configureEditorMarkdownSerializer(ctx: Ctx) {
  configureEditorTrailingParagraph(ctx);
  ctx.update(remarkPluginsCtx, (plugins) => [...plugins, { plugin: remarkTextColor, options: {} }, { plugin: remarkStandaloneSourceLinks, options: {} }, { plugin: remarkCanonicalMentions, options: {} }]);
