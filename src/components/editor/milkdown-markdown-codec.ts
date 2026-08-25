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

type DiceMarkdownNode = {
  nodeId?: unknown;
  notation?: unknown;
};

type EditorMarkdownNode = {
  type?: string;
  data?: Record<string, unknown>;
  children?: EditorMarkdownNode[];
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
      diceInline: (node: DiceMarkdownNode) => serializeDiceMarkdownNode(node),
    } as NonNullable<typeof options.handlers>,
  }));
}

function isEmptyParagraph(node: ProseNode | null | undefined): boolean {
  return node?.type.name === "paragraph" && node.content.size === 0;
}

/** 只规范化编辑器自身的合法输出；这里禁止调用任何字面降级净化器。 */
export function serializeEditorMarkdown(ctx: Ctx, doc: ProseNode): string {
  let markdown = sanitizeEmptyImages(
    ctx.get(serializerCtx)(doc).replace(/\r\n?/gu, "\n"),
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
