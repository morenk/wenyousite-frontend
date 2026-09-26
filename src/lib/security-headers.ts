export const MEDIA_ORIGIN = "https://cn-nb1.rains3.com";

export function createContentSecurityPolicy({
  nonce,
  isDevelopment,
  previewMediaOrigin,
}: {
  nonce: string;
  isDevelopment: boolean;
  previewMediaOrigin?: string;
}): string {
  if (previewMediaOrigin && (!isDevelopment || !/^http:\/\/127\.0\.0\.1:\d+$/.test(previewMediaOrigin))) {
    throw new Error("预览媒体地址只允许独立开发 loopback 服务");
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${MEDIA_ORIGIN}${previewMediaOrigin ? ` ${previewMediaOrigin}` : ""}`,
    "font-src 'self' data:",
    `connect-src 'self' ${previewMediaOrigin ?? MEDIA_ORIGIN}${isDevelopment ? " ws: wss:" : ""}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
