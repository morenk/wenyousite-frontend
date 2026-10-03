import type { AndroidDownloadInfo, AndroidDownloadRelease } from "@/lib/app-download";

/** 隔离消费者样本；不对应线上 APK，也不包含存储位置。 */
export function downloadRelease(buildNumber = 42): AndroidDownloadRelease {
  return {
    platform: "android", applicationId: "site.wenyou.app", versionName: `0.3.0-dev.${buildNumber}`,
    buildNumber, sizeBytes: 33_554_432, sha256: "a".repeat(64),
    fileName: `wenyou-0.3.0-dev.${buildNumber}-${buildNumber}.apk`, publishedAt: "2026-10-02T12:00:00.000Z",
    downloadUrl: `https://wenyou.site/api/v1/app-downloads/android/${buildNumber}/file`,
    releaseNotesUrl: `https://wenyou.site/api/v1/mobile-releases/android/${buildNumber}`,
  };
}

export function availableDownload(buildNumber = 42): AndroidDownloadInfo {
  return { status: "available", release: downloadRelease(buildNumber), retryAfterSeconds: null };
}

export function downloadHeaders(release = downloadRelease()): Record<string, string> {
  return {
    "content-type": "application/vnd.android.package-archive", "content-length": String(release.sizeBytes),
    "content-disposition": `attachment; filename="${release.fileName}"`,
    "x-amz-meta-apk-sha256": release.sha256, "x-amz-meta-application-id": release.applicationId,
    "x-amz-meta-version-name": release.versionName, "x-amz-meta-version-code": String(release.buildNumber),
  };
}
