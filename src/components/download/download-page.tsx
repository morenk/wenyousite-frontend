"use client";

import { useAppDownload } from "@/api/hooks/use-app-download";
import { AppDownloadError, DOWNLOAD_PAGE_URL, formatApkSize } from "@/lib/app-download";
import { DownloadPageView, type DownloadAvailability } from "./download-page-view";

export function DownloadPage() {
  const { query, pending, waiting, fileError, handedOff, nativeDownloadPath, download, refresh } = useAppDownload();
  const info = query.data?.info;
  const release = info?.status === "available" ? info.release : null;
  const error = fileError || query.error;
  let availability: DownloadAvailability = "loading";
  if (error) {
    availability = error instanceof AppDownloadError && error.status === 429 ? "rate-limited"
      : fileError ? "unavailable" : "error";
  } else if (info) {
    availability = info.status === "available" ? "ready" : info.status === "no_release" ? "empty" : info.status;
  }
  const feedback = waiting ? "请稍后重试，等待结束后可重新获取下载信息。"
    : fileError instanceof AppDownloadError && fileError.status === 409 ? "版本信息已变化，请重新获取后再下载。"
    : handedOff ? "已交给浏览器下载，请在下载列表查看。若未开始，请稍后重新获取下载信息再试。" : undefined;

  return <><DownloadPageView
    availability={availability}
    release={release ? { versionLabel: release.versionName, buildLabel: String(release.buildNumber), sizeLabel: formatApkSize(release.sizeBytes) } : undefined}
    pageUrl={DOWNLOAD_PAGE_URL}
    pending={pending}
    downloadDisabled={waiting || handedOff || query.isFetching}
    retryDisabled={waiting || pending}
    retryPending={query.isFetching && !query.isPending}
    feedback={feedback}
    onDownload={download}
    onRetry={refresh}
  />
    {nativeDownloadPath && <iframe title="Android 安装包下载" src={nativeDownloadPath} sandbox="allow-downloads allow-same-origin" hidden />}
  </>;
}
