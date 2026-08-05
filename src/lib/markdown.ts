/** Markdown 工具：规范化编辑器内容并保留顶层空段落协议 */

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

/** 发布/暂存前统一清理 Milkdown 序列化残留。 */
export function sanitizeMilkdownMarkdown(markdown: string): string {
  return sanitizeOutsideFencedCode(markdown);
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
