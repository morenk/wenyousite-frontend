/** 仅隔离开发模式启用；上传签名 URL 保持原样，不向媒体增加自定义签名头。 */
export async function verifyPreviewUpload(uploadUrl: string, signal?: AbortSignal): Promise<void> {
  const runId = process.env.NEXT_PUBLIC_WENYOU_PREVIEW_RUN;
  if (!runId) return;
  const mediaOrigin = process.env.NEXT_PUBLIC_WENYOU_PREVIEW_MEDIA_ORIGIN;
  const target = new URL(uploadUrl);
  if (!mediaOrigin || target.origin !== mediaOrigin || target.username || target.password || target.hash) {
    throw new Error("图片上传目标不属于当前隔离预览");
  }
  const response = await fetch("/__preview/identity", { redirect: "error", cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) });
  if (response.status !== 200 || response.headers.get("x-wenyou-preview-run") !== runId) throw new Error("预览身份已失效，请重新连接开发会话");
  const identity = await response.json();
  if (identity.role !== "web" || identity.runId !== runId || identity.mediaOrigin !== mediaOrigin) {
    throw new Error("预览媒体身份不匹配");
  }
}
