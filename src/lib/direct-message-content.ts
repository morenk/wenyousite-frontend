/** 保留正文换行，同时移除会在气泡末尾占位的行尾空白。 */
export function normalizeDirectMessageContent(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+(?=\n|$)/g, "")
    .trim();
}
