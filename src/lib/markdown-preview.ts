import type Token from "markdown-it/lib/token.mjs";
import { DICE_INLINE_MARKER_SOURCE } from "@/lib/dice-inline";
import { formatInternalReferencePreview } from "@/lib/internal-reference";
import { analyzeMarkdownBlockBoundaries } from "@/lib/markdown-block-boundaries";
import { recoverCodeAttention } from "@/lib/markdown-attention";

function inlinePreview(tokens: Token[], omitImages: boolean, recoverAttention = true): string {
  if (recoverAttention) {
    let linkDepth = 0;
    for (let index = 0; index < tokens.length; index++) {
      const code = tokens[index]!;
      if (code.type === "link_open") linkDepth++;
      if (code.type === "link_close") linkDepth--;
      if (linkDepth || index === 0 || index + 1 === tokens.length) continue;
      const before = tokens[index - 1]!;
      const after = tokens[index + 1]!;
      const range = code.meta as { source: string; start: number; end: number } | null;
      if (code.type !== "code_inline" || before.type !== "text" || after.type !== "text" || !range) continue;
      // 完整阅读器与摘要共享同一窄范围历史恢复；源码位置来自实际 backticks rule。
      const nodes = [
        { type: "text", value: before.content, position: { end: { offset: range.start } } },
        { type: "inlineCode", value: code.content, position: { start: { offset: range.start }, end: { offset: range.end } } },
        { type: "text", value: after.content, position: { start: { offset: range.end } } },
      ];
      recoverCodeAttention(nodes, range.source);
      before.content = nodes[0]!.value!;
      after.content = nodes[2]!.value!;
    }
  }
  let value = "";
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (token.type === "code_inline") {
      // 代码已由解析器识别，内部星号、实体和 URL 不再解释。
      value += token.content;
    } else if (token.type === "text") {
      value += formatInternalReferencePreview(token.content).replace(
        new RegExp(DICE_INLINE_MARKER_SOURCE, "giu"),
        (_marker, _nodeId: string, notation: string) => `[${notation}]`,
      );
    } else if (token.type === "image") {
      if (!omitImages) value += "[图片]";
    } else if (token.type === "softbreak" || token.type === "hardbreak") {
      value += " ";
    } else if (token.type === "link_open") {
      let end = index + 1;
      while (end < tokens.length && tokens[end]!.type !== "link_close") end++;
      const label = inlinePreview(tokens.slice(index + 1, end), omitImages, false).trim();
      const href = token.attrGet("href") ?? "";
      const raw = token.info === "auto"
        ? tokens.slice(index + 1, end).map((child) => child.content).join("")
        : `[${label}](${href})`;
      const internal = formatInternalReferencePreview(raw);
      const trailing = token.info === "auto" ? label.match(/[.,!?;:，。！？；：、]+$/u)?.[0] ?? "" : "";
      value += internal !== raw ? internal : token.info === "auto" ? `[链接]${trailing}` : `[${label}]`;
      index = end;
    }
  }
  return value;
}

/** 将 Markdown 正文转换为紧凑预览；格式语法由解析器消费，代码内容不经正则去格式。 */
export function formatMarkdownPreview(markdown: string, options: { omitImages?: boolean; legacyHardBreaks?: boolean } = {}): string {
  const { tokens } = analyzeMarkdownBlockBoundaries(markdown);
  const lineCount = markdown.split("\n").length;
  return tokens.map((token) => {
    if (token.type === "inline") {
      const last = token.children?.at(-1);
      // 历史通知把块边界前的单反斜杠当作换行；仅处理源码对应的 text 尾部。
      if (options.legacyHardBreaks && token.map && token.map[1] < lineCount
        && (token.content.match(/\\+$/u)?.[0].length ?? 0) % 2 === 1
        && last?.type === "text" && last.content.endsWith("\\")) {
        last.content = last.content.slice(0, -1);
      }
      return inlinePreview(token.children ?? [], options.omitImages ?? false);
    }
    if (token.type === "code_block" || token.type === "fence") return token.content;
    return "";
  }).filter(Boolean).join(" ").replace(/\s+/gu, " ").trim();
}
