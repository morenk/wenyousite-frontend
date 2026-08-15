/** Markdown v3 工具：规范化、工具栏能力白名单与字面文本降级。 */

import MarkdownIt from "markdown-it";

/** 匹配图片语法中括号为空的写法：![alt]() 或 ![alt]( ) */
const EMPTY_IMAGE_REGEX = /!\[[^\]]*\]\(\s*\)/g;

/** 移除空 URL 的图片语法，避免序列化出破图（本站不支持外链图片，src 必填） */
export function sanitizeEmptyImages(markdown: string): string {
  return markdown.replace(EMPTY_IMAGE_REGEX, "");
}

/**
 * 规范化 Milkdown 空段落协议并清理空图片。
 * 围栏代码块和正文行内内容必须原样保留；独占行 br 统一写成标准 `<br />`。
 */
function sanitizeOutsideFencedCode(markdown: string): string {
  const parts = markdown.replace(/\r\n?/g, "\n").split(/(\n)/);
  let fence: { marker: "`" | "~"; length: number } | null = null;

  for (let index = 0; index < parts.length; index += 2) {
    const line = parts[index] ?? "";
    const fenceToken = line.match(/^ {0,3}(`{3,}|~{3,})/u)?.[1];

    if (fence) {
      const closingToken = line.match(/^ {0,3}(`{3,}|~{3,})[\t ]*$/u)?.[1];
      if (
        closingToken?.[0] === fence.marker &&
        closingToken.length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }

    if (fenceToken) {
      fence = {
        marker: fenceToken[0] as "`" | "~",
        length: fenceToken.length,
      };
      continue;
    }

    if (/^ {0,3}<br\s*\/?>[\t ]*$/iu.test(line)) {
      parts[index] = "<br />";
      continue;
    }

    parts[index] = line.replace(EMPTY_IMAGE_REGEX, "");
  }

  return parts.join("");
}

function normalizeMilkdownMarkdown(markdown: string): string {
  return sanitizeOutsideFencedCode(markdown);
}

const EMPTY_PARAGRAPH_RE = /^ {0,3}<br\s*\/?>[\t ]*$/iu;
const TASK_LIST_RE = /^(?: {0,3}>[\t ]*)*[\t ]*(?:[-+*]|\d+[.)])[\t ]+\[[ xX]\](?:[\t ]|$)/u;
const UNKNOWN_PROTOCOL_RE = /\[\[([a-z][a-z0-9_-]*):v(\d+):/giu;
const WORD_JOINER = "\u2060";
const MAX_LIST_DEPTH = 3;

export const UNSUPPORTED_MARKDOWN_TYPE_LABELS = {
  table: "表格",
  "task-list": "任务列表",
  "fenced-code-block": "围栏代码块",
  "indented-code-block": "缩进代码块",
  "heading-1": "一级标题",
  "heading-4-6": "四至六级标题",
  "hard-break": "显式硬换行",
  "raw-html": "原始 HTML",
  "unknown-protocol": "未知协议节点",
  "list-depth": "超过三层的嵌套列表",
  "unsafe-link": "不安全链接",
  "unknown-node": "未知 Markdown 节点",
} as const;

export type UnsupportedMarkdownType = keyof typeof UNSUPPORTED_MARKDOWN_TYPE_LABELS;

export interface UnsupportedMarkdownIssue {
  type: UnsupportedMarkdownType;
  startLine: number;
  endLine: number;
}

const markdownParser = new MarkdownIt({ html: true, linkify: true, typographer: false });

function issue(
  type: UnsupportedMarkdownType,
  map: [number, number] | null | undefined,
): UnsupportedMarkdownIssue {
  return {
    type,
    startLine: map?.[0] ?? 0,
    endLine: Math.max((map?.[1] ?? 1) - 1, map?.[0] ?? 0),
  };
}

function isSafeUrl(url: string, image: boolean): boolean {
  if (/^(?:https?:\/\/|\/)/iu.test(url)) return true;
  if (!image && /^(?:mailto:|#)/iu.test(url)) return true;
  return false;
}

function hardBreakLines(lines: string[], start: number, end: number): number[] {
  const result: number[] = [];
  for (let line = start; line < end; line++) {
    const value = lines[line] ?? "";
    const trailingSpaces = value.match(/ +$/u)?.[0].length ?? 0;
    const trailingBackslashes = value.match(/\\+$/u)?.[0].length ?? 0;
    if (trailingSpaces >= 2 || trailingBackslashes % 2 === 1) result.push(line);
  }
  return result;
}

function isEscaped(value: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor--) slashes++;
  return slashes % 2 === 1;
}

function maskInlineCode(line: string): string {
  const chars = [...line];
  let index = 0;
  while (index < line.length) {
    if (line[index] !== "`" || isEscaped(line, index)) {
      index++;
      continue;
    }
    let length = 1;
    while (line[index + length] === "`") length++;
    const delimiter = "`".repeat(length);
    const closing = line.indexOf(delimiter, index + length);
    if (closing < 0) {
      index += length;
      continue;
    }
    for (let cursor = index; cursor < closing + length; cursor++) chars[cursor] = " ";
    index = closing + length;
  }
  return chars.join("");
}

/** 返回按源码位置排序的全部工具栏白名单外结构。 */
export function findUnsupportedMarkdownFormats(markdown: string): UnsupportedMarkdownIssue[] {
  const normalized = normalizeMilkdownMarkdown(markdown);
  const lines = normalized.split("\n");
  const parseSource = lines
    .map((line) => (EMPTY_PARAGRAPH_RE.test(line) ? "wenyousite-empty-paragraph" : line))
    .join("\n");
  const issues: UnsupportedMarkdownIssue[] = [];
  let listDepth = 0;

  for (const token of markdownParser.parse(parseSource, {})) {
    switch (token.type) {
      case "table_open":
        issues.push(issue("table", token.map));
        break;
      case "fence":
        issues.push(issue("fenced-code-block", token.map));
        break;
      case "code_block":
        issues.push(issue("indented-code-block", token.map));
        break;
      case "heading_open": {
        const level = Number(token.tag.slice(1));
        if (level === 1) issues.push(issue("heading-1", token.map));
        if (level >= 4) issues.push(issue("heading-4-6", token.map));
        break;
      }
      case "html_block":
        issues.push(issue("raw-html", token.map));
        break;
      case "bullet_list_open":
      case "ordered_list_open":
        listDepth++;
        if (listDepth > MAX_LIST_DEPTH) issues.push(issue("list-depth", token.map));
        break;
      case "bullet_list_close":
      case "ordered_list_close":
        listDepth--;
        break;
      case "inline": {
        const map = token.map;
        if (token.children?.some((child) => child.type === "hardbreak")) {
          for (const line of hardBreakLines(lines, map?.[0] ?? 0, map?.[1] ?? 1)) {
            issues.push({ type: "hard-break", startLine: line, endLine: line });
          }
        }
        for (const child of token.children ?? []) {
          if (child.type === "html_inline") {
            issues.push(issue("raw-html", map));
          } else if (child.type === "link_open") {
            if (!isSafeUrl(child.attrGet("href") ?? "", false)) {
              issues.push(issue("unsafe-link", map));
            }
          } else if (child.type === "image") {
            if (!isSafeUrl(child.attrGet("src") ?? "", true)) {
              issues.push(issue("unsafe-link", map));
            }
          }
        }
        break;
      }
      case "paragraph_open":
      case "paragraph_close":
      case "text":
      case "softbreak":
      case "code_inline":
      case "em_open":
      case "em_close":
      case "strong_open":
      case "strong_close":
      case "s_open":
      case "s_close":
      case "link_open":
      case "link_close":
      case "image":
      case "heading_close":
      case "blockquote_open":
      case "blockquote_close":
      case "list_item_open":
      case "list_item_close":
      case "hr":
      case "table_close":
      case "thead_open":
      case "thead_close":
      case "tbody_open":
      case "tbody_close":
      case "tr_open":
      case "tr_close":
      case "th_open":
      case "th_close":
      case "td_open":
      case "td_close":
        break;
      default:
        issues.push(issue("unknown-node", token.map));
    }
  }

  for (let line = 0; line < lines.length; line++) {
    if (TASK_LIST_RE.test(lines[line]!)) {
      issues.push({ type: "task-list", startLine: line, endLine: line });
    }
    const masked = maskInlineCode(lines[line]!);
    for (const match of masked.matchAll(UNKNOWN_PROTOCOL_RE)) {
      if (isEscaped(lines[line]!, match.index ?? 0)) continue;
      if (match[1]!.toLowerCase() === "dice" && match[2] === "1") continue;
      issues.push({ type: "unknown-protocol", startLine: line, endLine: line });
      break;
    }
  }

  const seen = new Set<string>();
  return issues
    .sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine)
    .filter((item) => {
      const key = `${item.type}:${item.startLine}:${item.endLine}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function escapeLiteralLine(line: string): string {
  let escaped = line.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/gu, "\\$&");
  if (/^(?: {4}|\t)/u.test(line)) escaped = `${WORD_JOINER}${escaped}`;
  if (/ {2,}$/u.test(line)) escaped = `${escaped}${WORD_JOINER}`;
  return escaped || WORD_JOINER;
}

/** 把不支持节点的源码保留为可见普通文字，不生成结构节点。 */
export function literalizeUnsupportedMarkdown(markdown: string): string {
  const normalized = normalizeMilkdownMarkdown(markdown);
  const issues = findUnsupportedMarkdownFormats(normalized);
  if (issues.length === 0) return normalized;
  const lines = normalized.split("\n");
  const affected = new Set<number>();
  for (const item of issues) {
    for (let line = item.startLine; line <= item.endLine; line++) affected.add(line);
  }
  const output: string[] = [];
  for (let line = 0; line < lines.length; line++) {
    if (!affected.has(line)) {
      output.push(lines[line]!);
      continue;
    }
    if (output.length > 0 && output.at(-1) !== "") output.push("");
    output.push(escapeLiteralLine(lines[line]!));
    if (line < lines.length - 1) output.push("");
  }
  return output.join("\n");
}

/** 发布、暂存和阅读前统一规范化，并无提示地把白名单外结构降为字面文本。 */
export function sanitizeMilkdownMarkdown(markdown: string): string {
  return literalizeUnsupportedMarkdown(markdown);
}

const IMAGE_RE = /!\[[^\]]*\]\(\s*[^)\s]+[^)]*\)/;
const EMPTY_LINK_RE = /\[[^\]]*\]\(\s*\)/g;
const LINK_RE = /\[([^\]]+)\]\(\s*[^)\s]+[^)]*\)/g;
const HTTP_AUTOLINK_RE = /<https?:\/\/[^\s<>]+>/iu;
const HTML_RE = /<[^>]*>/g;
const THEMATIC_BREAK_RE = /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
/** 仅用于可见性判断；保留原文，避免破坏 ZWJ Emoji 和变体选择符。 */
const DEFAULT_IGNORABLE_RE = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/gu;

function hasNonIgnorableText(value: string): boolean {
  return value.replace(DEFAULT_IGNORABLE_RE, "").trim().length > 0;
}

/** 判断 Markdown 是否包含可发布的可见内容（图片可单独发布，分隔线不可单独发布）。 */
export function hasVisibleMarkdownContent(markdown: string): boolean {
  const lines = sanitizeMilkdownMarkdown(markdown).split("\n");
  let fence: { marker: "`" | "~"; length: number } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const fenceToken = rawLine.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
    if (fence) {
      const closingToken = rawLine.match(/^ {0,3}(`{3,}|~{3,})[\t ]*$/)?.[1];
      if (
        closingToken?.[0] === fence.marker &&
        closingToken.length >= fence.length
      ) {
        fence = null;
      } else if (hasNonIgnorableText(line)) {
        return true;
      }
      continue;
    }
    if (fenceToken) {
      fence = {
        marker: fenceToken[0] as "`" | "~",
        length: fenceToken.length,
      };
      continue;
    }
    if (!line || THEMATIC_BREAK_RE.test(rawLine)) continue;
    if (IMAGE_RE.test(line)) return true;
    // Milkdown 会把独占 URL 序列化为 CommonMark 自动链接；它不是 HTML 标签。
    if (HTTP_AUTOLINK_RE.test(line)) return true;
    const visible = line
      .replace(/^ {0,3}<br\s*\/?>[\t ]*$/iu, "")
      .replace(/!\[[^\]]*\]\(\s*\)/g, "")
      .replace(EMPTY_LINK_RE, "")
      .replace(LINK_RE, "$1")
      .replace(HTML_RE, "")
      // 只移除 Markdown 前缀；不能把正文开头的纯数字（如 123、1.00）当成列表标记。
      .replace(/^[#>+\-\s]+/u, "")
      .replace(/^\d+[.)]\s*/u, "")
      .replace(/[*_~`]/g, "")
      .replace(DEFAULT_IGNORABLE_RE, "")
      .trim();
    if (visible) return true;
  }
  return false;
}
