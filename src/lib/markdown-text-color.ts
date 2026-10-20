import { normalizeTextFont, TEXT_FONT_ATTRIBUTE, TEXT_FONT_MARK } from "@/lib/markdown-text-font";
import MarkdownIt from "markdown-it";
import htmlInlineRule from "markdown-it/lib/rules_inline/html_inline.mjs";
import { isMarkdownEscaped, maskMarkdownCode } from "@/lib/markdown-code";
import type Token from "markdown-it/lib/token.mjs";
import { parseMentionTarget } from "@/lib/mention";
import { parseInternalReference, tokenizeInternalReferenceText } from "@/lib/internal-reference";

export const TEXT_COLOR_ATTRIBUTE = "data-wenyou-color-v1";
export const TEXT_COLOR_MARK = "wenyouTextColor";
export function parseTextStyleOpenTag(value: string): { color: string | null; fontId: string | null } | null {
  if (!/^<span(?: data-wenyou-(?:color|font)-v1="[^"<>]*"){1,2}>$/u.test(value)) return null;
  const attributes = [...value.matchAll(/data-wenyou-(color|font)-v1="([^"<>]*)"/gu)];
  if (new Set(attributes.map((match) => match[1])).size !== attributes.length) return null;
  let color: string | null = null, fontId: string | null = null;
  for (const match of attributes) {
    if (match[1] === "color") { color = normalizeTextColor(match[2]); if (!color) return null; }
    else { fontId = normalizeTextFont(match[2]); if (!fontId) return null; }
  }
  return { color, fontId };
}
const parser = new MarkdownIt({ html: true, linkify: true, typographer: false });
parser.inline.ruler.at("html_inline", (state, silent) => {
  const start = state.pos;
  const count = state.tokens.length;
  const matched = htmlInlineRule(state, silent);
  const token = state.tokens.at(-1);
  if (!silent && matched && state.tokens.length > count && token?.type === "html_inline") {
    token.meta = { start, end: state.pos };
  }
  return matched;
});

export function normalizeTextColor(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/u.test(value) ? value.toUpperCase() : null;
}

function eligibleInner(tokens: readonly Token[], source: string): boolean {
  const masked = maskMarkdownCode(source);
  if (Array.from(masked.matchAll(/(?:\[\[dice:v\d+:|@全体玩家)/gu)).some((match) => !isMarkdownEscaped(source, match.index))) return false;
  if (tokenizeInternalReferenceText(masked).some((segment) => segment.type === "portal")) return false;
  return tokens.length > 0 && tokens.every((token, index) => {
    if (["html_inline", "image", "softbreak", "hardbreak"].includes(token.type)) return false;
    if (token.type !== "link_open") return true;
    const href = token.attrGet("href") ?? "";
    const close = tokens.slice(index + 1).findIndex((child) => child.type === "link_close");
    const label = tokens.slice(index + 1, close < 0 ? undefined : index + close + 1).map((child) => child.content).join("");
    return !parseMentionTarget(href, label) && !parseInternalReference(href);
  });
}

/** 只有解析器实际识别的、同一行最外层成对标签属于颜色；代码和转义不参与。 */
export function validTextColorTokens(tokens: readonly Token[], source: string): Set<Token> {
  const valid = new Set<Token>();
  const html = (parser.parseInline(source, {})[0]?.children ?? []).filter((token) => token.type === "html_inline");
  const positions = new Map<Token, { start: number; end: number }>();
  let indexInSource = 0;
  for (const token of tokens) {
    if (token.type !== "html_inline") continue;
    const original = html[indexInSource++];
    if (original?.content !== token.content || !original.meta) return valid;
    positions.set(token, original.meta);
  }
  for (let index = 0; index < tokens.length; index++) {
    const start = tokens[index]!;
    if (start.type !== "html_inline" || start.level !== 0 || !parseTextStyleOpenTag(start.content)) continue;
    let end = index + 1;
    while (end < tokens.length && tokens[end]!.type !== "html_inline") end++;
    const close = tokens[end];
    const from = positions.get(start)?.end;
    const to = close && positions.get(close)?.start;
    if (close?.content !== "</span>" || close.level !== 0 || from === undefined || to === undefined) continue;
    const inner = source.slice(from, to);
    if (inner.includes("\n") || !eligibleInner(tokens.slice(index + 1, end), inner)) continue;
    valid.add(start); valid.add(close);
    index = end;
  }
  return valid;
}

export function hasTextColorSource(source: string): boolean {
  return parser.parse(source, {}).some((block) => block.type === "inline" && [...validTextColorTokens(block.children ?? [], block.content)].some((token) => parseTextStyleOpenTag(token.content)?.color));
}

export function hasTextFontSource(source: string): boolean {
  return parser.parse(source, {}).some((block) => block.type === "inline" && [...validTextColorTokens(block.children ?? [], block.content)].some((token) => parseTextStyleOpenTag(token.content)?.fontId));
}

export type ColorMarkdownNode = {
  type?: string; value?: string; color?: string; fontId?: string; children?: ColorMarkdownNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
  position?: { start: { line: number; offset?: number }; end: { line: number; offset?: number } };
};

/** 受控标记转换为结构化节点；ReactMarkdown 仍保留 skipHtml，不开放原始 HTML。 */
export function remarkTextColor() {
  return (tree: ColorMarkdownNode, file: { value?: unknown }) => {
    const source = String(file.value ?? "");
    const visit = (node: ColorMarkdownNode) => {
      if (!node.children) return;
      const result: ColorMarkdownNode[] = [];
      for (let index = 0; index < node.children.length; index++) {
        const child = node.children[index]!;
        const match = child.type === "html" ? parseTextStyleOpenTag(child.value ?? "") : null;
        if (match && ["paragraph", "heading"].includes(node.type ?? "")) {
          let end = index + 1;
          while (end < node.children.length && node.children[end]!.type !== "html") end++;
          const close = node.children[end];
          const startLine = (child.position as { start?: { line?: number } } | undefined)?.start?.line;
          const endLine = (close?.position as { end?: { line?: number } } | undefined)?.end?.line;
          const fragment = source.slice(child.position?.start.offset, close?.position?.end.offset);
          const parsed = parser.parseInline(fragment, {})[0]?.children ?? [];
          if (close?.value === "</span>" && end > index + 1 && startLine === endLine
            && child.position?.start.offset !== undefined && close.position?.end.offset !== undefined
            && validTextColorTokens(parsed, fragment).size === 2) {
            const { color, fontId } = match;
            const children = node.children.slice(index + 1, end);
            children.forEach(visit);
            result.push({ type: fontId ? TEXT_FONT_MARK : TEXT_COLOR_MARK, color: color ?? undefined, fontId: fontId ?? undefined, children,
              data: { hName: "span", hProperties: { ...(fontId ? { [TEXT_FONT_ATTRIBUTE]: fontId } : {}), ...(color ? { [TEXT_COLOR_ATTRIBUTE]: color } : {}) } } });
            index = end;
            continue;
          }
        }
        visit(child);
        result.push(child);
      }
      node.children = result;
    };
    visit(tree);
  };
}

const isStyleNode = (node: ColorMarkdownNode) => node.type === TEXT_COLOR_MARK || node.type === TEXT_FONT_MARK;
const inlineContainers = new Set(["strong", "emphasis", "delete", "link"]);
/** Milkdown 会延续已打开的 mark；序列化前将颜色提升到最外层，拆分交叉的样式范围。 */
export function hoistTextColors(children: ColorMarkdownNode[]): ColorMarkdownNode[] {
  return children.flatMap((node) => {
    if (!node.children) return [node];
    const nested = hoistTextColors(node.children);
    if (isStyleNode(node)) {
      return nested.map((child) => {
        if (!isStyleNode(child)) return { ...node, children: [child] };
        const fontId = child.fontId ?? node.fontId;
        return { ...child, type: fontId ? TEXT_FONT_MARK : TEXT_COLOR_MARK, fontId, color: child.color ?? node.color };
      });
    }
    if (!inlineContainers.has(node.type ?? "") || !nested.some(isStyleNode)) {
      return [{ ...node, children: nested }];
    }
    const result: ColorMarkdownNode[] = [];
    let plain: ColorMarkdownNode[] = [];
    const flush = () => { if (plain.length) result.push({ ...node, children: plain }); plain = []; };
    for (const child of nested) {
      if (!isStyleNode(child)) { plain.push(child); continue; }
      flush();
      result.push({ ...child, children: [{ ...node, children: child.children }] });
    }
    flush();
    return result;
  });
}
