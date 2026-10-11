import { assertTextLimit } from "./catalog";
export const TEXT_FILE_BYTE_LIMIT = 64 * 1024;

/** 文件只在浏览器内读取；严格解码，避免把错误编码悄悄替换为乱码。 */
export async function readToolTextFile(file: File): Promise<string> {
  if (!/\.txt$/i.test(file.name)) throw new Error("请选择 .txt 文本文件");
  if (file.size > TEXT_FILE_BYTE_LIMIT) throw new Error("文本文件不能超过 64 KiB");
  let bytes: ArrayBuffer;
  try { bytes = await file.arrayBuffer(); }
  catch { throw new Error("文件读取失败，请重新选择"); }
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error("文件不是有效的 UTF-8 文本，请转换编码后重试"); }
  assertTextLimit(text);
  return text;
}

/** UTF-8 BOM 便于本地文本编辑器识别中文；不修改竖排正文。 */
export function downloadToolText(text: string): void {
  const url = URL.createObjectURL(new Blob(["\uFEFF", text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "竖排文字.txt";
  try { document.body.appendChild(anchor); anchor.click(); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
