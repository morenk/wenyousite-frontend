/** 身份在初次 HTML 启动时固定；Fast Refresh、路由切换与新会话不能覆盖旧文档。 */
export interface PreviewSession {
  runId: string;
  webSessionId: string;
  sessionId: string;
  task: string;
  webOrigin: string;
  mediaOrigin: string;
}

declare global {
  interface Window { __wenyouPreview?: Readonly<PreviewSession>; }
}

export function previewBootstrap(session: PreviewSession): string {
  return `if (!Object.hasOwn(window, "__wenyouPreview")) Object.defineProperty(window, "__wenyouPreview", {value:Object.freeze(${JSON.stringify(session).replace(/</g, "\\u003c")}),writable:false,configurable:false});`;
}

export function getPreviewRun(): string | null {
  if (typeof window === "undefined") return process.env.WENYOU_PREVIEW_RUN || null;
  // 预览 bundle 缺少文档身份时仍携带无效值，由代理拒绝，不能降级普通请求。
  return window.__wenyouPreview?.runId || (process.env.NEXT_PUBLIC_WENYOU_PREVIEW_RUN ? "missing-document-identity" : null);
}

export function previewStorageKey(key: string): string {
  const run = getPreviewRun();
  return run ? `${key}:${run}` : key;
}

export function expirePreview(): never {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("wenyou-preview-expired"));
  throw new Error("开发预览已切换，请重新载入当前会话");
}

/** 所有 API（含认证恢复与管理员请求）使用文档的固定身份，拒绝错批次响应。 */
export function previewFetch(fetchImpl: typeof fetch): typeof fetch {
  return async (input, init) => {
    const run = getPreviewRun();
    if (!run) return fetchImpl(input, init);
    const request = new Request(input, { ...init, cache: "no-store" });
    request.headers.set("X-Wenyou-Preview-Run", run);
    const webSessionId = typeof window === "undefined" ? process.env.WENYOU_PREVIEW_WEB_SESSION : window.__wenyouPreview?.webSessionId;
    request.headers.set("X-Wenyou-Preview-Web", webSessionId ?? "missing-document-identity");
    const response = await fetchImpl(request);
    if (response.headers.get("x-wenyou-preview-run") !== run || response.headers.get("x-wenyou-preview-web") !== webSessionId) expirePreview();
    return response;
  };
}
