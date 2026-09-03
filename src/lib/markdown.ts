/** Markdown v5 工具：规范化、工具栏能力白名单与字面文本降级。 */

import MarkdownIt from "markdown-it";

/** 匹配图片语法中括号为空的写法：![alt]() 或 ![alt]( ) */
const EMPTY_IMAGE_REGEX = /!\[[^\]]*\]\(\s*\)/g;
const markdownParser = new MarkdownIt({ html: true, linkify: true, typographer: false });

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
const BLANK_LINE_RE = /^[\t ]*$/u;
const TASK_LIST_RE = /^(?: {0,3}>[\t ]*)*[\t ]*(?:[-+*]|\d+[.)])[\t ]+\[[ xX]\](?:[\t ]|$)/u;
const UNKNOWN_PROTOCOL_RE = /\[\[([a-z][a-z0-9_-]*):v(\d+):/giu;
const ALIGNMENT_MARKER_RE = /^\[wenyousite-align-v1-(center|right)\]: #$/u;
const ALIGNMENT_PROTOCOL_RE = /\[wenyousite-align-v(\d+)-([a-z][a-z-]*)\]:/giu;
const STICKER_TITLE_PREFIX = "wenyousite-sticker:v1:";
const WORD_JOINER = "\u2060";
const MAX_LIST_DEPTH = 3;

/** 当前公网声明的 Markdown 正文契约版本。 */
export const ACTIVE_MARKDOWN_CONTRACT_VERSION = 5;
export const IMAGE_ALIGNMENT_MARKDOWN_CONTRACT_VERSION = 5;

export interface MarkdownValidationOptions {
  markdownContractVersion?: number;
}

function legacyBlankLineProtectedLines(markdown: string): Set<number> {
  const protectedLines = new Set<number>();
  for (const token of markdownParser.parse(markdown, {})) {
    if (!["fence", "code_block", "html_block"].includes(token.type) || !token.map) {
      continue;
    }
    for (let line = token.map[0]; line < token.map[1]; line++) {
      protectedLines.add(line);
    }
  }
  return protectedLines;
}

function hasRecoverableLegacyBlankRun(lines: string[]): boolean {
  let index = 0;
  while (index < lines.length) {
    if (!BLANK_LINE_RE.test(lines[index]!)) {
      index++;
      continue;
    }
    const start = index;
    while (index < lines.length && BLANK_LINE_RE.test(lines[index]!)) index++;
    const runLength = index - start;
    if (start === 0 || runLength > 1) return true;
  }
  return false;
}

/**
 * 阅读/编辑历史正文时恢复旧客户端写入的原始空行。
 *
 * CommonMark 会把段落之间任意数量的空行折叠为一次分段，因此仅把第二个及之后的
 * 内部空行恢复为协议空段；首部空行逐个恢复，尾部保留一个格式化换行。代码与原始
 * HTML 区域属于字面保护区，不参与这项启发式兼容。显式 `<br />` 本身保持幂等。
 */
export function recoverLegacyMarkdownEmptyParagraphs(markdown: string): string {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  if (!normalized.includes("\n")) return normalized;

  const lines = normalized.split("\n");
  if (lines.every((line) => BLANK_LINE_RE.test(line))) return normalized;
  if (!hasRecoverableLegacyBlankRun(lines)) return normalized;
  const protectedLines = legacyBlankLineProtectedLines(normalized);

  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    if (!BLANK_LINE_RE.test(line) || protectedLines.has(index)) {
      output.push(line);
      index++;
      continue;
    }

    const start = index;
    while (
      index < lines.length &&
      BLANK_LINE_RE.test(lines[index]!) &&
      !protectedLines.has(index)
    ) {
      index++;
    }
    const runLength = index - start;
    const atStart = start === 0;
    const atEnd = index === lines.length;

    if (atStart) {
      for (let count = 0; count < runLength; count++) {
        output.push("<br />", "");
      }
      continue;
    }

    // 一个空行是普通段落边界（或尾部格式化换行），其余才是历史空段落。
    output.push("");
    for (let count = 1; count < runLength; count++) {
      output.push("<br />");
      if (!atEnd || count < runLength - 1) output.push("");
    }
  }

  return output.join("\n");
}

/**
 * 为完整阅读态隔离开头的协议空段与正文，避免 CommonMark 把后续正文吞入原始 HTML 块。
 *
 * `<br />` 是协议允许的独占空段标记，但 react-markdown 在它后面紧接正文时会把整段
 * 识别为 raw HTML；阅读器随后跳过 raw HTML，导致正文完全不可见。这里只补充解析分隔，
 * 不改变存储内容，也不影响正文中间的协议空段或真正的原始 HTML。
 */
export function prepareMarkdownForReader(
  markdown: string,
  options: MarkdownValidationOptions = {},
): string {
  const normalized = sanitizeMilkdownMarkdown(
    recoverLegacyMarkdownEmptyParagraphs(markdown),
    options,
  );
  const lines = normalized.split("\n");
  let markerEnd = 0;

  while (
    markerEnd < lines.length &&
    EMPTY_PARAGRAPH_RE.test(lines[markerEnd]!)
  ) {
    markerEnd++;
  }

  if (
    markerEnd > 0 &&
    markerEnd < lines.length &&
    !BLANK_LINE_RE.test(lines[markerEnd]!)
  ) {
    lines.splice(markerEnd, 0, "");
  }

  return lines.join("\n");
}

/** 为 Milkdown 解析器隔开相邻协议标记；这些分隔空行不会成为编辑器段落。 */
export function prepareMilkdownEditorMarkdown(
  markdown: string,
  options: MarkdownValidationOptions = {},
): string {
  const lines = sanitizeMilkdownMarkdown(
    recoverLegacyMarkdownEmptyParagraphs(markdown),
    options,
  ).split("\n");
  const output: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (!EMPTY_PARAGRAPH_RE.test(line)) {
      output.push(line);
      continue;
    }

    if (output.length > 0 && !BLANK_LINE_RE.test(output.at(-1)!)) {
      output.push("");
    }
    output.push("<br />");
    const nextLine = lines[index + 1];
    if (nextLine !== undefined && !BLANK_LINE_RE.test(nextLine)) {
      output.push("");
    }
  }

  return output.join("\n");
}

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
  "invalid-alignment": "无效的段落对齐",
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
export function findUnsupportedMarkdownFormats(
  markdown: string,
  options: MarkdownValidationOptions = {},
): UnsupportedMarkdownIssue[] {
  const markdownContractVersion =
    options.markdownContractVersion ?? ACTIVE_MARKDOWN_CONTRACT_VERSION;
  const imageAlignmentEnabled =
    markdownContractVersion >= IMAGE_ALIGNMENT_MARKDOWN_CONTRACT_VERSION;
  const normalized = normalizeMilkdownMarkdown(markdown);
  const lines = normalized.split("\n");
  const parseSource = lines
    .map((line) => (EMPTY_PARAGRAPH_RE.test(line) ? "wenyousite-empty-paragraph" : line))
    .join("\n");
  const issues: UnsupportedMarkdownIssue[] = [];
  let listDepth = 0;
  const tokens = markdownParser.parse(parseSource, {});

  for (const token of tokens) {
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

  const topLevelBlocks = new Map(
    tokens
      .filter(
        (token) =>
          token.level === 0 &&
          token.map &&
          (token.type === "paragraph_open" || token.type === "heading_open"),
      )
      .map((token) => [token.map![0], token]),
  );

  for (let line = 0; line < lines.length; line++) {
    if (TASK_LIST_RE.test(lines[line]!)) {
      issues.push({ type: "task-list", startLine: line, endLine: line });
    }
    const masked = maskInlineCode(lines[line]!);
    const alignmentMarker = lines[line]!.match(ALIGNMENT_MARKER_RE);
    if (alignmentMarker) {
      const target = topLevelBlocks.get(line + 1);
      const inline = target
        ? tokens.find(
            (token) =>
              token.type === "inline" &&
              token.map?.[0] === target.map?.[0] &&
              token.map?.[1] === target.map?.[1],
          )
        : undefined;
      const inlineChildren = inline?.children ?? [];
      const hasRegularImage = inlineChildren.some(
        (child) =>
          child.type === "image" &&
          !child.attrGet("title")?.startsWith(STICKER_TITLE_PREFIX),
      );
      const hasStandaloneRegularImage =
        imageAlignmentEnabled &&
        inlineChildren.length === 1 &&
        inlineChildren[0]?.type === "image" &&
        !inlineChildren[0].attrGet("title")?.startsWith(STICKER_TITLE_PREFIX);
      const hasInlineContent = Boolean(inline?.content.trim());
      const eligibleHeading =
        target?.type === "heading_open" &&
        (target.tag === "h2" || target.tag === "h3") &&
        hasInlineContent &&
        !hasRegularImage;
      const eligibleParagraph =
        target?.type === "paragraph_open" &&
        !EMPTY_PARAGRAPH_RE.test(lines[line + 1] ?? "") &&
        ((hasInlineContent && !hasRegularImage) || hasStandaloneRegularImage);
      if (!eligibleHeading && !eligibleParagraph) {
        issues.push({ type: "invalid-alignment", startLine: line, endLine: line });
      }
      continue;
    }
    for (const match of masked.matchAll(ALIGNMENT_PROTOCOL_RE)) {
      if (isEscaped(lines[line]!, match.index ?? 0)) continue;
      issues.push({
        type: match[1] === "1" ? "invalid-alignment" : "unknown-protocol",
        startLine: line,
        endLine: line,
      });
      break;
    }
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
export function literalizeUnsupportedMarkdown(
  markdown: string,
  options: MarkdownValidationOptions = {},
): string {
  const normalized = normalizeMilkdownMarkdown(markdown);
  const issues = findUnsupportedMarkdownFormats(normalized, options);
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
export function sanitizeMilkdownMarkdown(
  markdown: string,
  options: MarkdownValidationOptions = {},
): string {
  let sanitized = normalizeMilkdownMarkdown(markdown);
  const maxPasses = sanitized.split("\n").length + 1;

  for (let pass = 0; pass < maxPasses; pass++) {
    if (findUnsupportedMarkdownFormats(sanitized, options).length === 0) return sanitized;
    const next = literalizeUnsupportedMarkdown(sanitized, options);
    if (next === sanitized) return sanitized;
    sanitized = next;
  }

  // 防御性终点：理论上每轮至少消除一处结构；若未来解析器引入循环，整段按字面保留。
  return sanitized
    .split("\n")
    .map(escapeLiteralLine)
    .join("\n\n");
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
  const lines = normalizeMilkdownMarkdown(markdown).split("\n");
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
    if (
      !line ||
      THEMATIC_BREAK_RE.test(rawLine) ||
      ALIGNMENT_MARKER_RE.test(rawLine)
    ) continue;
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
