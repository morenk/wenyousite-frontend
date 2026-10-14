import type { components } from "@/api/types";

export type AndroidDownloadInfo = components["schemas"]["AndroidDownloadInfoDto"];
export type AndroidDownloadRelease = components["schemas"]["AndroidDownloadReleaseDto"];
export const ANDROID_DOWNLOAD_BASE_URL = "https://wenyou-apk.cn-nb1.rains3.com/mobile/android/";

/** 只接受同一制品的固定桶地址，不推测地址、不回退历史网关。 */
export function androidDownloadUrl(release: AndroidDownloadRelease): string {
  if (release.platform !== "android" || release.applicationId !== "site.wenyou.app"
    || !Number.isInteger(release.buildNumber) || release.buildNumber < 1 || release.buildNumber > 2_100_000_000
    || !Number.isInteger(release.sizeBytes) || release.sizeBytes < 1 || release.sizeBytes > 536_870_912
    || !/^[0-9a-f]{64}$/.test(release.sha256) || typeof release.versionName !== "string" || !/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/.test(release.versionName)) {
    throw new Error("安装包信息无效");
  }
  const fileName = `wenyou-${release.versionName}-${release.buildNumber}.apk`;
  if (release.fileName !== fileName || release.downloadUrl !== `${ANDROID_DOWNLOAD_BASE_URL}${fileName}`
    || release.releaseNotesUrl !== `https://wenyou.site/api/v1/mobile-releases/android/${release.buildNumber}`) {
    throw new Error("安装包地址无效");
  }
  return release.downloadUrl;
}

export function validateAndroidDownloadInfo(info: AndroidDownloadInfo): AndroidDownloadInfo {
  if (!info || !["available", "no_release", "unavailable"].includes(info.status)
    || info.retryAfterSeconds !== null) {
    throw new Error("下载信息无效");
  }
  if (info.status === "available") {
    if (!info.release) throw new Error("安装包信息缺失");
    androidDownloadUrl(info.release);
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
    && [
      `attachment; filename="${release.fileName}"`,
      `attachment; filename=${release.fileName}`,
    ].includes(headers.get("content-disposition") ?? "")
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
  ) {
    super("下载请求暂未完成");
  }

  static fromResponse(response: Response) {
    return new AppDownloadError(response.status, retryAfterDeadline(response.headers.get("retry-after")));
  }
}
