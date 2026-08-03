/** Markdown 清理工具：移除编辑器生成的无效图片与不可见空段落标记 */

/** 匹配图片语法中括号为空的写法：![alt]() 或 ![alt]( ) */
const EMPTY_IMAGE_REGEX = /!\[[^\]]*\]\(\s*\)/g;

/** 移除空 URL 的图片语法，避免序列化出破图（本站不支持外链图片，src 必填） */
export function sanitizeEmptyImages(markdown: string): string {
  return markdown.replace(EMPTY_IMAGE_REGEX, "");
}

/**
 * 移除 Milkdown 为保留空段落而生成的独占行 `<br />`。
 *
 * 围栏代码块和正文行内的 br 文本必须原样保留，避免破坏代码示例或用户显式内容。
 */
function sanitizeOutsideFencedCode(markdown: string): string {
  const parts = markdown.split(/(\r?\n)/);
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
      parts[index] = "";
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
