import {
  remarkStringifyOptionsCtx,
  serializerCtx,
} from "@milkdown/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose, $remark } from "@milkdown/kit/utils";
import {
  findUnsupportedMarkdownFormats,
  prepareMilkdownEditorMarkdown,
  sanitizeEmptyImages,
} from "@/lib/markdown";
import { serializeInlineDiceNode } from "@/lib/dice-inline";
import { remarkRecoverAttentionBoundaries } from "@/lib/markdown-attention";
import { normalizeSerializedAlignmentMarkers } from "@/lib/markdown-alignment";

type DiceMarkdownNode = {
  nodeId?: unknown;
  notation?: unknown;
};

type EditorMarkdownNode = {
  type?: string;
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
}

export class EditorMarkdownCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorMarkdownCodecError";
  }
}

/** 原始正文只在进入编辑器时执行历史兼容与字面降级。 */
export function prepareEditorMarkdown(markdown: string): string {
  return prepareMilkdownEditorMarkdown(markdown);
}

/** 产品阅读态保留普通 LF；回填编辑器时也恢复成可见换行，而不是折叠为空格。 */
export const editorSoftBreakParser = $remark(
  "wenyousite-editor-soft-break",
  () => () => (tree) => {
    const visit = (node: EditorMarkdownNode) => {
      if (node.type === "break" && node.data?.isInline === true) {
        node.data = { ...node.data, isInline: false };
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
  const handler: MarkdownHandler = (nodeValue, _parent, stateValue, infoValue) => {
    const node = nodeValue as EditorMarkdownNode & { marker?: unknown };
    const state = stateValue as SerializerState;
    const info = infoValue as SerializerInfo;
    const marker = construct === "strikethrough"
      ? "~"
      : node.marker === "_"
        ? "_"
        : "*";
    const delimiter = marker.repeat(repetitions);
    const exit = state.enter(construct);
    const tracker = state.createTracker(info);
    const before = tracker.move(delimiter);
    let between = tracker.move(state.containerPhrasing(node, {
      after: marker,
      before,
      ...tracker.current(),
    } as SerializerInfo));
    const open = getAttentionEncodeSides(
      lastCodePoint(info.before),
      firstCodePoint(between),
      marker,
    );
    if (open.inside) between = encodeFirstCodePoint(between);

    const close = getAttentionEncodeSides(
      firstCodePoint(info.after),
      lastCodePoint(between),
      marker,
    );
    if (close.inside) between = encodeLastCodePoint(between);
    const after = tracker.move(delimiter);
    exit();

    state.attentionEncodeSurroundingInfo = {
      before: open.outside,
      after: close.outside,
    };
    return `${before}${between}${after}`;
  };
  handler.peek = (nodeValue) => {
    const marker = (nodeValue as { marker?: unknown } | undefined)?.marker;
    return construct !== "strikethrough" && marker === "_" ? "_" : fallbackMarker;
  };
  return handler;
}

const safeStrongMarkdownHandler = createSafeAttentionMarkdownHandler("strong", 2);
const safeEmphasisMarkdownHandler = createSafeAttentionMarkdownHandler("emphasis", 1);
const safeDeleteMarkdownHandler = createSafeAttentionMarkdownHandler("strikethrough", 2);

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
  ctx.update(remarkStringifyOptionsCtx, (options) => ({
    ...options,
    rule: "-" as const,
    ruleRepetition: 3,
    ruleSpaces: false,
    handlers: {
      ...options.handlers,
      break: () => "\n",
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

const EMPTY_BLOCKQUOTE_PARAGRAPH_RE = /^((?: {0,3}>[\t ]*)+)<br \/>[\t ]*$/gmu;

/** Milkdown 会用 HTML break 保留引用内的空段；空引用本身用 CommonMark 标记即可无损表示。 */
function normalizeEmptyBlockquoteParagraphs(markdown: string): string {
  return markdown.replace(
    EMPTY_BLOCKQUOTE_PARAGRAPH_RE,
    (_line, prefix: string) => prefix.trimEnd(),
  );
}

/** 只规范化编辑器自身的合法输出；这里禁止调用任何字面降级净化器。 */
export function serializeEditorMarkdown(ctx: Ctx, doc: ProseNode): string {
  let markdown = normalizeSerializedAlignmentMarkers(
    normalizeEmptyBlockquoteParagraphs(
      sanitizeEmptyImages(
        ctx.get(serializerCtx)(doc).replace(/\r\n?/gu, "\n"),
      ),
    ),
  );

  if (doc.childCount === 1 && isEmptyParagraph(doc.lastChild)) {
    markdown = "";
  } else if (isEmptyParagraph(doc.lastChild)) {
    markdown = `${markdown.replace(/\s+$/u, "")}\n\n<br />`;
  } else {
    // remark-stringify 固定附加一个格式化换行，它不属于用户正文。
    markdown = markdown.replace(/\n$/u, "");
  }

  const unsupported = findUnsupportedMarkdownFormats(markdown);
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
}: EditorMarkdownBridgeOptions) {
  return $prose((ctx) => {
    let previousMarkdown: string | undefined;
    return new Plugin({
      key: new PluginKey("wenyousite-editor-markdown-bridge"),
      view: (view) => {
        previousMarkdown = serializeEditorMarkdown(ctx, view.state.doc);
        return {
          update: (nextView, previousState) => {
            if (nextView.state.doc.eq(previousState.doc)) return;
            try {
              const markdown = serializeEditorMarkdown(ctx, nextView.state.doc);
              if (markdown === previousMarkdown) return;
              previousMarkdown = markdown;
              onChange(markdown);
            } catch (error) {
              onError?.(error);
            }
          },
        };
      },
    });
  });
}
