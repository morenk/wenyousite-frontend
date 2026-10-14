import { androidDownloadUrl, type AndroidDownloadRelease } from "@/lib/app-download";

/** 桶不是本站 API；预检只读响应头，不能带认证、中间件请求头或下载完整正文。 */
export function headAndroidDownload(release: AndroidDownloadRelease, signal: AbortSignal): Promise<Response> {
  return globalThis.fetch(androidDownloadUrl(release), {
    method: "HEAD", mode: "cors", credentials: "omit", redirect: "error",
    cache: "no-store", referrerPolicy: "no-referrer", signal,
  });
}
