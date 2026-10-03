import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useAppDownload } from "@/api/hooks/use-app-download";
import { queryKeys } from "@/api/query-keys";
import { AppDownloadError } from "@/lib/app-download";
import { availableDownload, downloadHeaders } from "@/test/app-download";
import { server } from "@/test/msw/server";
import { createQueryWrapper, createTestQueryClient } from "@/test/query-client";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

function infoHandler() {
  const get = vi.fn(() => HttpResponse.json({ code: 0, message: "ok", data: availableDownload() }));
  server.use(http.get("*/api/v1/app-downloads/android", get));
  return get;
}

describe("公开下载消费者", () => {
  test("browse-without-file-request / download-explicit-action / download-browser-handoff", async () => {
    const info = infoHandler();
    const head = vi.fn(() => new HttpResponse(null, { headers: downloadHeaders() }));
    const get = vi.fn(() => new HttpResponse(null));
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", head), http.get("*/api/v1/app-downloads/android/:build/file", get));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(info).toHaveBeenCalledTimes(1);
    expect(head).not.toHaveBeenCalled();
    act(() => result.current.refresh());
    await waitFor(() => expect(info).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.query.isFetching).toBe(false));
    expect(head).not.toHaveBeenCalled();
    await act(async () => { await Promise.all([result.current.download(), result.current.download()]); });
    expect(head).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
    expect(result.current.nativeDownloadPath).toBe("/api/v1/app-downloads/android/42/file");
    expect(result.current.handedOff).toBe(true);
    await act(async () => { await result.current.download(); });
    expect(head).toHaveBeenCalledTimes(1);
    act(() => result.current.refresh());
    await waitFor(() => expect(info).toHaveBeenCalledTimes(3));
    expect(result.current.handedOff).toBe(false);
  });

  test.each([429, 503, 502, 404])("文件 %s 空正文不发 GET、不自动重试；刷新只重取信息", async (status) => {
    const info = infoHandler();
    const head = vi.fn(() => new HttpResponse(null, { status }));
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", head));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    await act(async () => { await result.current.download(); });
    expect(result.current.fileError).toBeInstanceOf(AppDownloadError);
    expect(result.current.fileError).toMatchObject({ status });
    expect(result.current.nativeDownloadPath).toBeNull();
    await act(async () => { await result.current.download(); });
    expect(head).toHaveBeenCalledTimes(1);
    act(() => result.current.refresh());
    await waitFor(() => expect(info).toHaveBeenCalledTimes(2));
    expect(head).toHaveBeenCalledTimes(1);
  });

  test("download-rate-limited 尊重 Retry-After；到期不循环探测", async () => {
    const info = infoHandler();
    const head = vi.fn(() => new HttpResponse(null, { status: 429, headers: { "Retry-After": "1" } }));
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", head));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    await act(async () => { await result.current.download(); });
    expect(result.current.waiting).toBe(true);
    act(() => result.current.refresh());
    expect(info).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.waiting).toBe(false), { timeout: 2000 });
    expect(info).toHaveBeenCalledTimes(1);
    expect(head).toHaveBeenCalledTimes(1);
    act(() => result.current.refresh());
    await waitFor(() => expect(info).toHaveBeenCalledTimes(2));
  });

  test("info-refresh-failure 保留展示信息但暂停下载", async () => {
    infoHandler();
    const head = vi.fn(() => new HttpResponse(null));
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", head));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    server.use(http.get("*/api/v1/app-downloads/android", () => new HttpResponse(null, { status: 503 })));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.query.data?.info.release?.buildNumber).toBe(42);
    await act(async () => { await result.current.download(); });
    expect(head).not.toHaveBeenCalled();
  });

  test("info-target-race 新信息到达后，旧预检不启动任何版本的 GET", async () => {
    infoHandler();
    let complete!: () => void;
    const entered = vi.fn();
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", async () => {
      entered();
      await new Promise<void>((resolve) => { complete = resolve; });
      return new HttpResponse(null, { headers: downloadHeaders() });
    }));
    const client = createTestQueryClient();
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper(client).Wrapper });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    let action!: Promise<void>;
    act(() => { action = result.current.download(); });
    await waitFor(() => expect(entered).toHaveBeenCalled());
    act(() => client.setQueryData(queryKeys.appDownloads.android, { info: availableDownload(43), retryAt: null }));
    await act(async () => { complete(); await action; });
    expect(result.current.nativeDownloadPath).toBeNull();
    expect(result.current.query.data?.info.release?.buildNumber).toBe(43);
    expect(result.current.fileError).toMatchObject({ status: 409 });
  });

  test("离开页面取消预检，不在旧页面完成后继续下载", async () => {
    infoHandler();
    let complete!: () => void;
    const entered = vi.fn();
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", async () => {
      entered(); await new Promise<void>((resolve) => { complete = resolve; });
      return new HttpResponse(null, { headers: downloadHeaders() });
    }));
    const { result, unmount } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    let action!: Promise<void>;
    act(() => { action = result.current.download(); });
    await waitFor(() => expect(entered).toHaveBeenCalled());
    unmount();
    await act(async () => { complete(); await action; });
    expect(result.current.nativeDownloadPath).toBeNull();
  });
});
