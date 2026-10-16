import { describe, expect, test } from "vitest";
import {
  AppDownloadError, androidDownloadUrl, matchesAndroidDownload,
  retryAfterDeadline, retryDeadline, validateAndroidDownloadInfo,
} from "@/lib/app-download";
import { availableDownload, downloadHeaders, downloadRelease } from "@/test/app-download";

describe("下载制品身份与等待时间", () => {
  test("429 只采用通用状态与 Retry-After，不消费旧网关每日额度原因", () => {
    const before = Date.now();
    const error = AppDownloadError.fromResponse(new Response(null, { status: 429, headers: {
      "X-Download-Limit-Reason": "device_daily_limit", "Retry-After": "60",
    } }));
    expect(error.status).toBe(429);
    expect(error).not.toHaveProperty("limitReason");
    expect(error.retryAt).toBeGreaterThanOrEqual(before + 60_000);
  });

  test("只接受同一制品的固定桶地址，拒绝旧网关、注入与临时地址", () => {
    const release = downloadRelease();
    expect(androidDownloadUrl(release)).toBe(release.downloadUrl);
    for (const downloadUrl of ["https://bucket.example/a.apk", "https://wenyou.site/api/v1/app-downloads/android/42/file", "javascript:alert(1)", "/api/v1/app-downloads/android/42/file",
      `${release.downloadUrl}?token=x`, `${release.downloadUrl}#x`, release.downloadUrl.replace("42", "43"),
      release.downloadUrl.replace("https:", "http:"), release.downloadUrl.replace("wenyou-apk.cn-nb1.rains3.com", "wenyou-apk.cn-nb1.rains3.com.evil"),
      release.downloadUrl.replace("/wenyou-", "/../wenyou-"), release.downloadUrl.replace("https://", "https://user@")]) {
      expect(() => androidDownloadUrl({ ...release, downloadUrl })).toThrow();
    }
    for (const patch of [{ buildNumber: 0 }, { buildNumber: 2.5 }, { buildNumber: 2_100_000_001 },
      { sizeBytes: 0 }, { sizeBytes: 536_870_913 }, { sizeBytes: 2.2 }, { sha256: "bad" },
      { applicationId: "other.app" }, { platform: "ios" as "android" }, { versionName: " " }, { versionName: "../evil" }, { versionName: "a".repeat(65) },
      { fileName: "other.apk" }, { releaseNotesUrl: "https://evil.test/notes" }]) {
      expect(() => androidDownloadUrl({ ...release, ...patch })).toThrow();
    }
  });

  test("明确状态决定是否有制品，不从空字段猜测无发布", () => {
    expect(validateAndroidDownloadInfo(availableDownload())).toEqual(availableDownload());
    for (const status of ["no_release", "unavailable"] as const) {
      const info = { status, release: null, retryAfterSeconds: null };
      expect(validateAndroidDownloadInfo(info)).toBe(info);
      expect(() => validateAndroidDownloadInfo({ ...info, release: downloadRelease() })).toThrow();
    }
    expect(() => validateAndroidDownloadInfo({ ...availableDownload(), release: null })).toThrow();
    for (const retryAfterSeconds of [0, 1, 30, -1, 1.5, Infinity]) {
      expect(() => validateAndroidDownloadInfo({ ...availableDownload(), retryAfterSeconds })).toThrow();
    }
    for (const status of ["unknown", "withdrawn", "paused"]) {
      expect(() => validateAndroidDownloadInfo({ ...availableDownload(), status: status as "available" })).toThrow();
    }
  });

  test("HEAD 必须对应同一大小、文件名、摘要、版本、包名和构建号", () => {
    const headers = downloadHeaders();
    expect(matchesAndroidDownload(new Response(null, { headers }), downloadRelease())).toBe(true);
    expect(matchesAndroidDownload(new Response(null, { status: 206, headers }), downloadRelease())).toBe(false);
    for (const disposition of ['inline; filename="wenyou-0.3.0-dev.42-42.apk"', 'attachment; filename="other.apk"', 'attachment; filename="wenyou-0.3.0-dev.42-42.apk"; filename*=UTF-8\'\'other.apk']) {
      expect(matchesAndroidDownload(new Response(null, { headers: { ...headers, "content-disposition": disposition } }), downloadRelease())).toBe(false);
    }
    for (const key of Object.keys(headers)) {
      expect(matchesAndroidDownload(new Response(null, { headers: { ...headers, [key]: "wrong" } }), downloadRelease())).toBe(false);
      const missing = { ...headers }; delete missing[key];
      expect(matchesAndroidDownload(new Response(null, { headers: missing }), downloadRelease())).toBe(false);
    }
  });

  test("Retry-After 支持秒数及 HTTP 日期，不臆测非法值的恢复时间", () => {
    const now = Date.parse("2026-10-02T12:00:00Z");
    expect(retryAfterDeadline("30", now)).toBe(now + 30_000);
    expect(retryAfterDeadline("Fri, 02 Oct 2026 12:01:00 GMT", now)).toBe(now + 60_000);
    expect(retryAfterDeadline("Fri, 02 Oct 2026 11:00:00 GMT", now)).toBe(now);
    expect(retryAfterDeadline(null, now)).toBeNull();
    expect(retryAfterDeadline("invalid", now)).toBeNull();
    expect(retryAfterDeadline("99999999999999999999", now)).toBeNull();
    expect(retryDeadline(null, now)).toBeNull();
    expect(retryDeadline(-1, now)).toBeNull();
  });
});
