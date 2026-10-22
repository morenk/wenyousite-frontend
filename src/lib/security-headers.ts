export const MEDIA_ORIGIN = "https://cn-nb1.rains3.com";

export function createContentSecurityPolicy({
  nonce,
  isDevelopment,
}: {
  nonce: string;
  isDevelopment: boolean;
}): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${MEDIA_ORIGIN}`,
    "font-src 'self' data:",
    `connect-src 'self' ${MEDIA_ORIGIN} https://wenyou.site https://*.wenyou.site${isDevelopment ? " ws: wss:" : ""}`,
    `media-src 'self' blob: ${MEDIA_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
