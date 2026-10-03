"use client";

import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import { appDownloadOrigin } from "@/lib/preview-download";
import { AppDownloadError, androidDownloadPath, matchesAndroidDownload, retryDeadline, validateAndroidDownloadInfo } from "@/lib/app-download";

/** 到期只开放手动重试，不自动读取信息或下载文件。 */
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

export function useAppDownload(queryClient?: QueryClient) {
  const client = useQueryClient(queryClient);
  const query = useQuery({
    queryKey: queryKeys.appDownloads.android,
    queryFn: async ({ signal }) => {
      const downloadOrigin = await appDownloadOrigin(signal);
      const { data, response } = await apiClient.GET("/api/v1/app-downloads/android", {
        signal, cache: "no-store", redirect: "error", credentials: "same-origin",
      });
      if (!response.ok) throw AppDownloadError.fromResponse(response);
      if (!data?.data || data.code !== 0) throw new AppDownloadError(0);
      const info = validateAndroidDownloadInfo(data.data, downloadOrigin);
      return { info, retryAt: retryDeadline(info.retryAfterSeconds), downloadOrigin };
    },
    enabled: false,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  }, client);
  const [phase, setPhase] = useState<"idle" | "information" | "preflight">("idle");
  const [attempted, setAttempted] = useState(false);
  const [fileError, setFileError] = useState<unknown>(null);
  const [handedOff, setHandedOff] = useState(false);
  const [downloads, setDownloads] = useState<{ id: number; path: string }[]>([]);
  const active = useRef<AbortController | null>(null);
  const completed = useRef(false);
  const nextId = useRef(0);
  useEffect(() => () => { active.current?.abort(); }, []);
  const retryAt = fileError instanceof AppDownloadError ? fileError.retryAt
    : query.error instanceof AppDownloadError ? query.error.retryAt : query.data?.retryAt ?? null;
  const waiting = useRetryGate(retryAt);
  const pending = phase !== "idle";

  async function download(retry = false) {
    if (active.current || pending || waiting || (completed.current && !retry)) return;
    const controller = new AbortController();
    active.current = controller;
    completed.current = false;
    setAttempted(true);
    setFileError(null);
    setHandedOff(false);
    setPhase("information");
    try {
      // 每次明确点击都重新读取推荐，不能复用上次下载的可用性。
      const result = await query.refetch({ throwOnError: true });
      if (controller.signal.aborted || !result.data) return;
      const observed = client.getQueryState(queryKeys.appDownloads.android);
      const data = result.data;
      if (data.info.status !== "available" || !data.info.release || (data.retryAt !== null && data.retryAt > Date.now())) return;
      const release = data.info.release;
      const path = androidDownloadPath(release, data.downloadOrigin);
      setPhase("preflight");
      const { response } = await apiClient.HEAD("/api/v1/app-downloads/android/{buildNumber}/file", {
        params: { path: { buildNumber: release.buildNumber } },
        signal: controller.signal, cache: "no-store", redirect: "error", credentials: "same-origin",
      });
      if (!response.ok) throw AppDownloadError.fromResponse(response);
      if (!matchesAndroidDownload(response, release)) throw new AppDownloadError(503);
      const current = client.getQueryState(queryKeys.appDownloads.android);
      if (controller.signal.aborted) return;
      if (!current || current.data !== data || current.dataUpdatedAt !== observed?.dataUpdatedAt || current.status !== "success" || current.fetchStatus !== "idle" || current.isInvalidated) {
        throw new AppDownloadError(409);
      }
      completed.current = true;
      setHandedOff(true);
      // 应用级容器持有每次交接；重开菜单、切换路由或再次点击不移除旧下载载体。
      const id = ++nextId.current;
      setDownloads((current) => [...current, { id, path }]);
    } catch (error) {
      if (!controller.signal.aborted) setFileError(error);
    } finally {
      if (!controller.signal.aborted) setPhase("idle");
      if (active.current === controller) active.current = null;
    }
  }

  return { query, phase, attempted, pending, waiting, fileError, handedOff, downloads,
    download: () => download(), retry: () => download(true) };
}
