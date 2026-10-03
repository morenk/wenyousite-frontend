import { describe, expect, test } from "vitest";
import {
  AppDownloadError, androidDownloadPath, matchesAndroidDownload,
  retryAfterDeadline, retryDeadline, validateAndroidDownloadInfo,
} from "@/lib/app-download";
import { availableDownload, downloadHeaders, downloadRelease } from "@/test/app-download";

describe("下载制品身份与等待时间", () => {
  test.each(["device_daily_limit", "ip_daily_limit", "byte_budget", "request_rate", "concurrency", "bandwidth"])("429 的 %s 原因来自响应头，空正文仍保留等待时间", (reason) => {
    const before = Date.now();
    const error = AppDownloadError.fromResponse(new Response(null, { status: 429, headers: {
      "X-Download-Limit-Reason": reason, "Retry-After": "86400",
    } }));
    expect(error).toMatchObject({ status: 429, limitReason: reason });
    expect(error.retryAt).toBeGreaterThanOrEqual(before + 86_400_000);
    expect(error.retryAt).toBeLessThanOrEqual(Date.now() + 86_400_000);
  });

  test.each([[429, "future_limit"], [429, ""], [503, "device_daily_limit"]] as const)("%s / %s 不推断每日限制，仍尊重 Retry-After", (status, reason) => {
    const error = AppDownloadError.fromResponse(new Response(null, { status, headers: {
      ...(reason ? { "X-Download-Limit-Reason": reason } : {}), "Retry-After": "60",
    } }));
    expect(error).toMatchObject({ status, limitReason: null });
    expect(error.retryAt).not.toBeNull();
  });

  test("只接受同一构建的本站地址，不回退公开桶或临时地址", () => {
    const release = downloadRelease();
    expect(androidDownloadPath(release)).toBe("/api/v1/app-downloads/android/42/file");
    for (const downloadUrl of ["https://bucket.example/a.apk", "javascript:alert(1)", "/api/v1/app-downloads/android/42/file",
      `${release.downloadUrl}?token=x`, `${release.downloadUrl}#x`, release.downloadUrl.replace("42", "43"),
      release.downloadUrl.replace("https:", "http:"), release.downloadUrl.replace("wenyou.site", "wenyou.site.evil")]) {
      expect(() => androidDownloadPath({ ...release, downloadUrl })).toThrow();
    }
    for (const patch of [{ buildNumber: 0 }, { buildNumber: 2.5 }, { buildNumber: 2_100_000_001 },
      { sizeBytes: 0 }, { sizeBytes: 536_870_913 }, { sizeBytes: 2.2 }, { sha256: "bad" },
      { applicationId: "other.app" }, { platform: "ios" as "android" }, { versionName: " " }]) {
      expect(() => androidDownloadPath({ ...release, ...patch })).toThrow();
    }
  });

  test("明确状态决定是否有制品，不从空字段猜测无发布", () => {
    expect(validateAndroidDownloadInfo(availableDownload())).toEqual(availableDownload());
    for (const status of ["no_release", "withdrawn", "paused", "unavailable"] as const) {
      const info = { status, release: null, retryAfterSeconds: 30 };
      expect(validateAndroidDownloadInfo(info)).toBe(info);
      expect(() => validateAndroidDownloadInfo({ ...info, release: downloadRelease() })).toThrow();
    }
    expect(() => validateAndroidDownloadInfo({ ...availableDownload(), release: null })).toThrow();
    for (const retryAfterSeconds of [0, -1, 1.5, Infinity]) {
      expect(() => validateAndroidDownloadInfo({ ...availableDownload(), retryAfterSeconds })).toThrow();
    }
    expect(() => validateAndroidDownloadInfo({ ...availableDownload(), status: "unknown" as "available" })).toThrow();
  });

  test("HEAD 必须对应同一大小、摘要、版本、包名和构建号", () => {
    const headers = downloadHeaders();
    expect(matchesAndroidDownload(new Response(null, { headers }), downloadRelease())).toBe(true);
    expect(matchesAndroidDownload(new Response(null, { status: 206, headers }), downloadRelease())).toBe(false);
    for (const key of Object.keys(headers).filter((name) => name !== "content-disposition")) {
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
