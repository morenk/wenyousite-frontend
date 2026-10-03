"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import { appDownloadOrigin } from "@/lib/preview-download";
import {
  AppDownloadError,
  androidDownloadPath,
  matchesAndroidDownload,
  retryAfterDeadline,
  retryDeadline,
  validateAndroidDownloadInfo,
} from "@/lib/app-download";

/** Retry-After 到期只开放手动重试，不自动发出信息或文件请求。 */
function useRetryGate(deadline: number | null) {
  const [expired, setExpired] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === null) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (Date.now() >= deadline) setExpired(deadline);
        else schedule();
      }, Math.min(Math.max(0, deadline - Date.now()), 2_147_483_647));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [deadline]);
  return deadline !== null && expired !== deadline;
}

export function useAppDownload() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.appDownloads.android,
    queryFn: async ({ signal }) => {
      const downloadOrigin = await appDownloadOrigin(signal);
      const { data, response } = await apiClient.GET("/api/v1/app-downloads/android", {
        signal, cache: "no-store", redirect: "error",
      });
      if (!response.ok) throw new AppDownloadError(response.status, retryAfterDeadline(response.headers.get("retry-after")));
      if (!data?.data || data.code !== 0) throw new AppDownloadError(0);
      const info = validateAndroidDownloadInfo(data.data, downloadOrigin);
      return { info, retryAt: retryDeadline(info.retryAfterSeconds), downloadOrigin };
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [pending, setPending] = useState(false);
  const [fileError, setFileError] = useState<unknown>(null);
  const [nativeDownloadPath, setNativeDownloadPath] = useState<string | null>(null);
  const handedOff = nativeDownloadPath !== null;
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); }, []);
  const retryAt = fileError instanceof AppDownloadError ? fileError.retryAt
    : query.error instanceof AppDownloadError ? query.error.retryAt : query.data?.retryAt ?? null;
  const waiting = useRetryGate(retryAt);

  async function download() {
    const release = query.data?.info.status === "available" ? query.data.info.release : null;
    if (!release || query.isError || query.isFetching || pending || waiting || handedOff || fileError || active.current) return;
    const path = androidDownloadPath(release, query.data?.downloadOrigin);
    const observedAt = query.dataUpdatedAt;
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    try {
      const { response } = await apiClient.HEAD("/api/v1/app-downloads/android/{buildNumber}/file", {
        params: { path: { buildNumber: release.buildNumber } },
        signal: controller.signal, cache: "no-store", redirect: "error",
      });
      if (!response.ok) throw new AppDownloadError(response.status, retryAfterDeadline(response.headers.get("retry-after")));
      if (!matchesAndroidDownload(response, release)) throw new AppDownloadError(503);
      const current = client.getQueryState(queryKeys.appDownloads.android);
      if (controller.signal.aborted) return;
      if (!current || current.data !== query.data || current.dataUpdatedAt !== observedAt || current.status !== "success" || current.fetchStatus !== "idle" || current.isInvalidated) {
        throw new AppDownloadError(409);
      }
      // 受限下载框架保留当前页面；固定同源文件由浏览器保存，不读取正文或创建 blob。
      setNativeDownloadPath(path);
    } catch (error) {
      if (!controller.signal.aborted) setFileError(error);
    } finally {
      if (!controller.signal.aborted) setPending(false);
      if (active.current === controller) active.current = null;
    }
  }

  function refresh() {
    if (pending || waiting || query.isFetching) return;
    setFileError(null);
    setNativeDownloadPath(null);
    void query.refetch();
  }

  return { query, pending, waiting, fileError, handedOff, nativeDownloadPath, download, refresh };
}
