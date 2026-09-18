import {
  remarkStringifyOptionsCtx,
  serializerCtx,
} from "@milkdown/core";
import { paragraphAttr, textSchema } from "@milkdown/kit/preset/commonmark";
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
import { serializeInlineDiceNode } from "@/lib/dice-inline";
import { remarkRecoverAttentionBoundaries } from "@/lib/markdown-attention";
import { normalizeSerializedAlignmentMarkers } from "@/lib/markdown-alignment";

import { canonicalizeEditorEmptyRows, documentWithExplicitEmptyRows, handlePlainNewline } from "./editor-plain-newline";
import { adoptEditedTrailingParagraphs, configureEditorTrailingParagraph, withoutAutomaticTrailingParagraph } from "./editor-trailing-paragraph";

type DiceMarkdownNode = {
  nodeId?: unknown;
  notation?: unknown;
};

type EditorMarkdownNode = {
  type?: string;
  value?: string;
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
  onError?: (error: unknown) => void;
  onSyncErrorChange?: (hasError: boolean) => void;
  onValid?: () => void;
  onReady?: (flush: (() => string | null) | null) => void;
  markdownContractVersion?: number;
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

/**
 * 编辑器结构的 Markdown 写出规则。
 * Shift+Enter 在 ProseMirror 中仍是 break 节点，但存储协议把它写成普通 LF，
 * 避免 remark-stringify 生成反斜杠硬换行后再被发布净化器破坏。
 */
export function configureEditorMarkdownSerializer(ctx: Ctx) {
  configureEditorTrailingParagraph(ctx);
  ctx.update(paragraphAttr.key, (previous) => (node) => ({
    ...previous(node),
    ...(node.content.size === 0 ? { "data-wenyou-empty-row": "true" } : {}),
  }));
  const textHandler: MarkdownHandler = (nodeValue, _parent, stateValue, infoValue) => {
    const node = nodeValue as { value: string };
    const state = stateValue as SerializerState;
    const safe = state.safe(node.value, { ...infoValue as SerializerInfo, encode: [] });
    return node.value.endsWith(" ")
      ? safe.replace(/(?:&#x20;)+$/u, (tail) => " ".repeat(tail.length / 6)) : safe;
  };
  ctx.update(remarkStringifyOptionsCtx, (options) => ({
    ...options,
    rule: "-" as const,
    ruleRepetition: 3,
    ruleSpaces: false,
    unsafe: [...(options.unsafe ?? []), { character: ">" }],
    handlers: {
      ...options.handlers,
      // Milkdown 的尾随空白捷径会漏转义行首 >；所有文字均经标准安全输出。
      text: textHandler,
      wenyouBoundaryText: textHandler,
      break: () => "\n",
      paragraph: (node, _parent, state, info) => {
        const exit = state.enter("paragraph");
        const subexit = state.enter("phrasing");
        let value = state.containerPhrasing(node, info);
        subexit();
        exit();
        // CommonMark 会裁剪段落两端空格；只编码已有边界字符，不增加可见内容。
        if (/^[\t ]/u.test(value)) value = encodeFirstCodePoint(value);
        if (/[\t ]$/u.test(value)) value = encodeLastCodePoint(value);
        return value;
      },
      delete: safeDeleteMarkdownHandler,
      diceInline: (node: DiceMarkdownNode) => serializeDiceMarkdownNode(node),
      emphasis: safeEmphasisMarkdownHandler,
      strong: safeStrongMarkdownHandler,
    } as NonNullable<typeof options.handlers>,
  }));
}

function isEmptyParagraph(node: ProseNode | null | undefined): boolean {
  return node?.type.name === "paragraph" && node.content.size === 0;
}

/** 共享组合契约：非代码片段的边界空白外置，代码里的空白及全部 marks 原样保留。 */
function normalizeInlineBoundaryWhitespace(node: ProseNode): ProseNode {
  if (node.isLeaf) return node;
  const children: ProseNode[] = [];
  node.forEach((child, _offset, index) => {
    if (!child.isText || !child.marks.length || child.marks.some((mark) => mark.type.name === "inlineCode")) {
      children.push(normalizeInlineBoundaryWhitespace(child));
      return;
    }
    const text = child.text!;
    const leading = /^\p{White_Space}*/u.exec(text)![0];
    const trailing = /\p{White_Space}*$/u.exec(text)![0];
    const core = text.slice(leading.length, Math.max(leading.length, text.length - trailing.length));
    const sharedBefore = child.marks.filter((mark) => node.maybeChild(index - 1)?.marks.some((other) => mark.eq(other)));
    const sharedAfter = child.marks.filter((mark) => node.maybeChild(index + 1)?.marks.some((other) => mark.eq(other)));
    if (!core) {
      children.push(child.mark(sharedBefore.filter((mark) => sharedAfter.some((other) => mark.eq(other)))));
      return;
    }
    // 子节点分片不等于格式范围边界：保留跨越相邻节点的共同 marks。
    if (leading) children.push(node.type.schema.text(leading, sharedBefore));
    children.push(node.type.schema.text(core, child.marks));
    if (trailing) children.push(node.type.schema.text(trailing, sharedAfter));
  });
  return node.copy(Fragment.fromArray(children));
}

/** 只规范化编辑器自身的合法输出；这里禁止调用任何字面降级净化器。 */
export function serializeEditorMarkdown(
  ctx: Ctx,
  doc: ProseNode,
  options: MarkdownValidationOptions = {},
): string {
  doc = normalizeInlineBoundaryWhitespace(documentWithExplicitEmptyRows(withoutAutomaticTrailingParagraph(doc)));
  let markdown = normalizeSerializedAlignmentMarkers(
    canonicalizeEditorEmptyRows(
      sanitizeEmptyImages(
        ctx.get(serializerCtx)(doc).replace(/\r\n?/gu, "\n"),
      ),
    ),
  );

  if (doc.childCount === 1 && isEmptyParagraph(doc.lastChild)) {
    markdown = "";
  } else if (isEmptyParagraph(doc.lastChild)) {
    let trailingRows = 0;
    for (let index = doc.childCount - 1; index >= 0 && isEmptyParagraph(doc.child(index)); index--) trailingRows++;
    const lines = markdown.split("\n");
    while (lines.length > 0 && (lines.at(-1) === "" || lines.at(-1) === "<br />")) lines.pop();
    // A root empty row after a structural block still needs its Markdown
    // boundary. Plain text rows do not need that source-only separator.
    const precedingIndex = doc.childCount - trailingRows - 1;
    if (precedingIndex >= 0 && doc.child(precedingIndex).type.name !== "paragraph") lines.push("");
    markdown = [...lines, ...Array.from({ length: trailingRows }, () => "<br />")].join("\n");
  } else {
    // remark-stringify 固定附加一个格式化换行，它不属于用户正文。
    markdown = markdown.replace(/\n$/u, "");
  }

  const unsupported = findUnsupportedMarkdownFormats(markdown, options);
  if (unsupported.length > 0) {
    const first = unsupported[0]!;
    throw new EditorMarkdownCodecError(
      `编辑器生成了协议外 Markdown：${first.type}（第 ${first.startLine + 1} 行）`,
    );
  }
  return markdown;
}

/**
 * 唯一的文档变更出口：每个 docChanged 事务完成后立即序列化并同步父表单。
 * 不依赖 Milkdown 的防抖 markdownUpdated 事件，因此发布按钮不会读到旧正文。
 */
export function createEditorMarkdownBridge({
  onChange,
  onError,
  onReady,
  onValid,
  onSyncErrorChange,
  markdownContractVersion,
}: EditorMarkdownBridgeOptions) {
  return $prose((ctx) => {
    let previousMarkdown: string | undefined;
    return new Plugin({
      key: new PluginKey("wenyousite-editor-markdown-bridge"),
      appendTransaction: (transactions, _previous, state) => transactions.some((tr) => tr.docChanged)
        ? adoptEditedTrailingParagraphs(state) : null,
      props: {
        handleKeyDown: (nextView, event) => {
          if (handlePlainNewline(nextView, event)) return true;
          if (
            event.key !== " "
            || event.isComposing
            || event.ctrlKey
            || event.metaKey
            || event.altKey
          ) return false;

          const { state } = nextView;
          const { selection } = state;
          if (selection.empty === false) return false;

          const activeMarks = state.storedMarks ?? selection.$from.marks();
          const beforeMarks = selection.$from.nodeBefore?.marks ?? [];
          const afterMarks = selection.$from.nodeAfter?.marks ?? [];
          const atFormatBoundary = beforeMarks.some((before) =>
            INLINE_FORMAT_MARK_NAMES.has(before.type.name)
            && !afterMarks.some((after) => after.type === before.type),
          );
          if (!atFormatBoundary) return false;

          nextView.dispatch(
            state.tr
              .setStoredMarks([])
              .insertText(" ", selection.from)
              .setStoredMarks(activeMarks),
          );
          return true;
        },
      },
      view: (view) => {
        let failed = false;
        const flush = (notify = true) => {
          try {
            const markdown = serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion });
            const changed = failed || markdown !== previousMarkdown;
            previousMarkdown = markdown;
            failed = false;
            onSyncErrorChange?.(false);
            onValid?.();
            if (changed && notify) onChange(markdown);
            return markdown;
          } catch (error) {
            failed = true;
            onSyncErrorChange?.(true);
            onError?.(error);
            return null;
          }
        };
        flush(false);
        onReady?.(() => flush());
        return {
          update: (nextView, previousState) => {
            if (!nextView.state.doc.eq(previousState.doc)) flush();
          },
          destroy: () => onReady?.(null),
        };
      },
    });
  });
}
