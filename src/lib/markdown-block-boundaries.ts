/** Markdown v5 块边界分析；Web 阅读、校验、编辑和摘要共用，后端共享语料固定语义。 */

import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import backtickRule from "markdown-it/lib/rules_inline/backticks.mjs";

export const ALIGNMENT_MARKER_RE = /^\[wenyousite-align-v1-(center|right)\]: #$/u;
const EMPTY_ROW_RE = /^ {0,3}<br\s*\/?>[\t ]*$/iu;
const QUOTED_EMPTY_ROW_RE = /^ {0,3}>[\t ]?<br\s*\/?>[\t ]*$/iu;
const parserOptions = { html: true, linkify: true, typographer: false };
const ordinaryParser = new MarkdownIt(parserOptions);
const boundaryParser = new MarkdownIt(parserOptions);

// 记录真实 inline rule 消费的区间；URL/title 中的反引号不参与代码匹配。
ordinaryParser.inline.ruler.at("backticks", (state, silent) => {
  const start = state.pos;
  const count = state.tokens.length;
  const matched = backtickRule(state, silent);
  const token = state.tokens.at(-1);
  if (!silent && matched && state.tokens.length > count && token?.type === "code_inline") {
    token.meta = { source: state.src, start, end: state.pos };
  }
  return matched;
});

for (const parser of [ordinaryParser, boundaryParser]) {
  parser.block.ruler.before(
    'html_block',
    'empty_row',
    (state, line, _end, silent) => {
      const env = state.env as BoundaryEnvironment;
      if (env.protectedLines?.has(line)) return false;
      const rawLine = env.lines[line]!;
      if (
        !(state.level === 0 && EMPTY_ROW_RE.test(rawLine)) &&
        !(state.level === 1 && QUOTED_EMPTY_ROW_RE.test(rawLine))
      )
        return false;
      if (silent) return true;
      const token = state.push('hr', 'hr', 0);
      token.map = [line, line + 1];
      token.meta = { emptyRow: true };
      state.line = line + 1;
      return true;
    },
    // 保护扫描不可用空段规则截断原段落中的跨行 code；起始空段仍独立解析以免吞掉后文 HTML。
    { alt: parser === ordinaryParser ? [] : ['paragraph', 'reference', 'blockquote'] },
  );
}

export interface MarkdownAlignmentBoundary {
  alignment: 'center' | 'right';
  markerLine: number;
  startLine: number;
  endLine: number;
  type: 'paragraph' | 'heading-2' | 'heading-3' | 'image';
}

interface BoundaryEnvironment {
  lines: string[];
  protectedLines: Set<number>;
}

// 协议行本身终止前一个块；不插入存储空行，也不改变 token 的原始行号。
boundaryParser.block.ruler.before(
  'reference',
  'alignment_boundary',
  (state, line, _end, silent) => {
    const env = state.env as BoundaryEnvironment;
    if (!ALIGNMENT_MARKER_RE.test(env.lines[line]!) || env.protectedLines.has(line)) return false;
    if (silent) return true;
    if (state.level !== 0) return false;
    const token = state.push('alignment_marker', '', 0);
    token.map = [line, line + 1];
    token.content = env.lines[line]!;
    state.line = line + 1;
    return true;
  },
  { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
);

/** 按真实通用解析结果保护代码/HTML；成对反引号可跨行，偏移使用 UTF-16。 */
function protectedSource(lines: string[]): { protectedLines: Set<number>; maskedLines: string[] } {
  const protectedLines = new Set<number>();
  const maskedLines = [...lines];
  for (const token of ordinaryParser.parse(lines.join('\n'), { lines })) {
    if (!token.map) continue;
    const [start, end] = token.map;
    if (['fence', 'code_block', 'html_block'].includes(token.type)) {
      for (let line = start; line < end; line++) {
        protectedLines.add(line);
        maskedLines[line] = '';
      }
    } else if (
      token.type === 'inline' &&
      token.children?.some((child) => child.type === 'code_inline')
    ) {
      const inlineLines = token.content.split("\n");
      const chars = token.content.split("");
      for (const child of token.children ?? []) {
        if (child.type !== "code_inline") continue;
        const range = child.meta as { source: string; start: number; end: number } | null;
        if (!range || range.source !== token.content) continue;
        for (let offset = range.start; offset < range.end; offset++) {
          if (chars[offset] !== "\n") chars[offset] = " ";
        }
      }
      const masked = chars.join("").split("\n");
      for (let line = start; line < end; line++) {
        const contentLine = inlineLines[line - start] ?? "";
        const offset = lines[line]!.indexOf(contentLine);
        if (offset < 0) continue;
        maskedLines[line] = lines[line]!.slice(0, offset) + (masked[line - start] ?? "")
          + lines[line]!.slice(offset + contentLine.length);
        if ((ALIGNMENT_MARKER_RE.test(lines[line]!) && !ALIGNMENT_MARKER_RE.test(maskedLines[line]!))
          || (EMPTY_ROW_RE.test(lines[line]!) && !EMPTY_ROW_RE.test(maskedLines[line]!))
          || (QUOTED_EMPTY_ROW_RE.test(lines[line]!) && !QUOTED_EMPTY_ROW_RE.test(maskedLines[line]!))) {
          protectedLines.add(line);
        }
      }
    }
  }
  return { protectedLines, maskedLines };
}

/** 输入为规范化正文；输出的 map/startLine/endLine 始终是原始零基行号（endLine 含尾行）。 */
export function analyzeMarkdownBlockBoundaries(source: string, markdownContractVersion = 5) {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const { protectedLines, maskedLines } = protectedSource(lines);
  const tokens = boundaryParser.parse(lines.join('\n'), {
    lines,
    protectedLines,
  } satisfies BoundaryEnvironment);
  const boundaries: MarkdownAlignmentBoundary[] = [];
  const markerLines = new Set<number>();
  const invalidMarkerLines: number[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const marker = tokens[index]!;
    if (marker.type !== 'alignment_marker' || !marker.map) continue;
    const line = marker.map[0];
    markerLines.add(line);
    const target = tokens[index + 1];
    const inline = tokens[index + 2];
    const type = eligibleTarget(target, inline, markdownContractVersion);
    if (!type || target?.map?.[0] !== line + 1) {
      invalidMarkerLines.push(line);
      continue;
    }
    boundaries.push({
      alignment: marker.content.match(ALIGNMENT_MARKER_RE)![1] as 'center' | 'right',
      markerLine: line,
      startLine: target.map[0],
      endLine: target.map![1] - 1,
      type,
    });
  }
  return { tokens, boundaries, markerLines, invalidMarkerLines, protectedLines, maskedLines };
}

function eligibleTarget(
  target: Token | undefined,
  inline: Token | undefined,
  version: number,
): MarkdownAlignmentBoundary['type'] | null {
  if (!target || target.level !== 0 || inline?.type !== 'inline' || !inline.content.trim())
    return null;
  const children = inline.children ?? [];
  const regularImages = children.filter(
    (child) =>
      child.type === 'image' && !child.attrGet('title')?.startsWith('wenyousite-sticker:v1:'),
  );
  if (target.type === 'paragraph_open') {
    if (!regularImages.length) return 'paragraph';
    if (version >= 5 && children.length === 1 && regularImages.length === 1) return 'image';
  }
  if (target.type === 'heading_open' && !regularImages.length) {
    if (target.tag === 'h2') return 'heading-2';
    if (target.tag === 'h3') return 'heading-3';
  }
  return null;
}

/** 只移除已确认合法的隐藏元数据，保留代码、转义及非法源码的可见身份。 */
export function stripMarkdownAlignmentMetadata(source: string): string {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const hidden = new Set(
    analyzeMarkdownBlockBoundaries(source).boundaries.map((boundary) => boundary.markerLine),
  );
  return lines.filter((_line, index) => !hidden.has(index)).join('\n');
}

/** 仅补充解析器所需的分段，不把分隔写成协议空段；同时保留原始行号映射。 */
export function projectMarkdownBlockBoundaries(source: string, version = 5) {
  const lines = source.replace(/\r\n?/gu, "\n").split("\n");
  const analysis = analyzeMarkdownBlockBoundaries(source, version);
  const starts = new Set(analysis.boundaries.map((boundary) => boundary.markerLine));
  const output: string[] = [];
  const sourceLines: Array<number | null> = [];
  lines.forEach((line, index) => {
    if (starts.has(index) && index > 0 && output.at(-1)?.trim()) {
      output.push("");
      sourceLines.push(null);
    }
    output.push(line);
    sourceLines.push(index);
  });
  return { markdown: output.join("\n"), sourceLines };
}
