export type MobileDevice = "android" | "ios" | "other";

/** 仅用于平台提示，不参与下载授权；视口宽度不能证明是移动设备。 */
export function detectMobileDevice({ userAgent, maxTouchPoints = 0, mobileHint = false }: {
  userAgent: string; maxTouchPoints?: number; mobileHint?: boolean;
}): MobileDevice | null {
  if (/Android/i.test(userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return "ios";
  if (mobileHint || /Mobi|IEMobile|Opera Mini/i.test(userAgent)) return "other";
  return null;
}
