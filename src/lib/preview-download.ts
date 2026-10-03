/** 仅信任本轮预览代理实际核验的 Backend origin；文件请求仍使用 Web 同源路径。 */
export async function appDownloadOrigin(signal?: AbortSignal): Promise<string> {
  const runId = process.env.NEXT_PUBLIC_WENYOU_PREVIEW_RUN;
  if (!runId) return "https://wenyou.site";
  const response = await fetch("/__preview/identity", {
    redirect: "error", cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
  });
  if (response.status !== 200 || response.headers.get("x-wenyou-preview-run") !== runId) throw new Error("预览身份已失效");
  const identity = await response.json();
  const origin = new URL(identity.backendOrigin);
  if (identity.role !== "web" || identity.runId !== runId || identity.resourceId !== runId
    || origin.origin !== identity.backendOrigin || origin.protocol !== "http:" || origin.hostname !== "127.0.0.1"
    || !origin.port || Number(origin.port) < 1024 || ["3000", "3001", "5432", "6379"].includes(origin.port)) {
    throw new Error("预览下载身份不匹配");
  }
  return origin.origin;
}
