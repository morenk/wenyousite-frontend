/** Markdown 清理工具：移除空 URL 的图片语法（如 ![]() / ![1.00]()） */

/** 匹配图片语法中括号为空的写法：![alt]() 或 ![alt]( ) */
const EMPTY_IMAGE_REGEX = /!\[[^\]]*\]\(\s*\)/g;

/** 移除空 URL 的图片语法，避免序列化出破图（本站不支持外链图片，src 必填） */
export function sanitizeEmptyImages(markdown: string): string {
  return markdown.replace(EMPTY_IMAGE_REGEX, "");
}
