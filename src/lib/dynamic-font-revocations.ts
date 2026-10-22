/** 浏览器文档级撤回账本，独立于描述符/目录 LRU；只保存最多 4096 个版本 ID。 */
const revoked = new Set<string>();
let denyAll = false;
export const MAX_FONT_REVOCATIONS = 4096;
export function isDynamicFontRevoked(id: string) {
  return denyAll || revoked.has(id);
}
export function rememberFontRevocation(id: string) {
  if (isDynamicFontRevoked(id)) return false;
  if (revoked.size === MAX_FONT_REVOCATIONS) denyAll = true;
  else revoked.add(id);
  return true;
}
export function fontRevocationSnapshot() {
  return { versions: revoked.size, denyAll };
}
