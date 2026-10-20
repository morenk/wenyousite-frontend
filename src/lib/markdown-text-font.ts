import catalog from "../../contracts/thread-font-catalog-v1.json";

export const TEXT_FONT_ATTRIBUTE = "data-wenyou-font-v1";
export const TEXT_FONT_MARK = "wenyouTextFont";
export const TEXT_FONT_CATALOG = catalog.fonts;
const ids = new Set(catalog.fonts.map((font) => font.id));
export function normalizeTextFont(value: unknown): string | null {
  return typeof value === "string" && ids.has(value) ? value : null;
}
/** 只引用目录白名单对应的运行时变量；不接受 CSS 字体名或外部 URL。 */
export function textFontFamily(value: unknown): string | undefined {
  const id = normalizeTextFont(value);
  return id ? `var(--wenyou-content-font-${id}, var(--wenyou-font-body-family, system-ui))` : undefined;
}
