import type { components, operations } from "@/api/types";

export type AndroidDownloadInfo = components["schemas"]["AndroidDownloadInfoDto"];
export type AndroidDownloadRelease = components["schemas"]["AndroidDownloadReleaseDto"];
export type DownloadLimitReason = NonNullable<operations["appDownloadsHead"]["responses"][429]["headers"]["X-Download-Limit-Reason"]>;

const downloadLimitReasons: Record<DownloadLimitReason, true> = {
  device_daily_limit: true, ip_daily_limit: true, byte_budget: true,
  request_rate: true, concurrency: true, bandwidth: true,
};

/** 只接受已发布身份绑定的本站固定地址；浏览器实际请求始终留在当前同源代理。 */
export function androidDownloadPath(release: AndroidDownloadRelease): string {
  if (release.platform !== "android" || release.applicationId !== "site.wenyou.app"
    || !Number.isInteger(release.buildNumber) || release.buildNumber < 1 || release.buildNumber > 2_100_000_000
    || !Number.isInteger(release.sizeBytes) || release.sizeBytes < 1 || release.sizeBytes > 536_870_912
    || !/^[0-9a-f]{64}$/.test(release.sha256) || !release.versionName?.trim()) {
    throw new Error("安装包信息无效");
  }
  const path = `/api/v1/app-downloads/android/${release.buildNumber}/file`;
  if (release.downloadUrl !== `https://wenyou.site${path}`) throw new Error("安装包地址无效");
  return path;
}

export function validateAndroidDownloadInfo(info: AndroidDownloadInfo): AndroidDownloadInfo {
  if (!info || !["available", "no_release", "withdrawn", "paused", "unavailable"].includes(info.status)
    || (info.retryAfterSeconds !== null && (!Number.isSafeInteger(info.retryAfterSeconds) || info.retryAfterSeconds < 1))) {
    throw new Error("下载信息无效");
  }
  if (info.status === "available") {
    if (!info.release) throw new Error("安装包信息缺失");
    androidDownloadPath(info.release);
  } else if (info.release !== null) {
    throw new Error("下载状态与安装包信息不一致");
  }
  return info;
}

/** 预检与点击时看到的制品必须完全一致，不以成功状态码替代身份核验。 */
export function matchesAndroidDownload(response: Response, release: AndroidDownloadRelease): boolean {
  const headers = response.headers;
  return response.status === 200
    && headers.get("content-type")?.split(";")[0].trim() === "application/vnd.android.package-archive"
    && headers.get("content-length") === String(release.sizeBytes)
    && headers.get("x-amz-meta-apk-sha256") === release.sha256
    && headers.get("x-amz-meta-application-id") === release.applicationId
    && headers.get("x-amz-meta-version-name") === release.versionName
    && headers.get("x-amz-meta-version-code") === String(release.buildNumber);
}

export function retryDeadline(seconds: number | null, now = Date.now()): number | null {
  if (seconds === null) return null;
  const deadline = now + seconds * 1000;
  return Number.isSafeInteger(deadline) && deadline >= now ? deadline : null;
}

export function retryAfterDeadline(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return retryDeadline(Number(value), now);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.max(now, parsed) : null;
}

export class AppDownloadError extends Error {
  constructor(
    public readonly status: number,
    public readonly retryAt: number | null = null,
    public readonly limitReason: DownloadLimitReason | null = null,
  ) {
    super("下载请求暂未完成");
  }

  static fromResponse(response: Response) {
    const reason = response.headers.get("x-download-limit-reason");
    const limitReason = response.status === 429 && reason && Object.hasOwn(downloadLimitReasons, reason)
      ? reason as DownloadLimitReason : null;
    return new AppDownloadError(response.status, retryAfterDeadline(response.headers.get("retry-after")), limitReason);
  }
}
