import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useAppDownload } from "@/api/hooks/use-app-download";
import { queryKeys } from "@/api/query-keys";
import { availableDownload, downloadHeaders } from "@/test/app-download";
import { server } from "@/test/msw/server";
import { createQueryWrapper, createTestQueryClient } from "@/test/query-client";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function handlers() {
  const info = vi.fn(() => HttpResponse.json({ code: 0, data: availableDownload() }));
  const head = vi.fn(() => new HttpResponse(null, { headers: downloadHeaders() }));
  const get = vi.fn(() => new HttpResponse(null));
  server.use(http.get("*/api/v1/app-downloads/android", info), http.head("*/api/v1/app-downloads/android/:build/file", head), http.get("*/api/v1/app-downloads/android/:build/file", get));
  return { info, head, get };
}

describe("点击一次获取信息、核验并交接下载", () => {
  test("挂载不请求信息/文件，一次点击串行查询与 HEAD，连续点击不会重复交接", async () => {
    const { info, head, get } = handlers();
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    expect(info).not.toHaveBeenCalled(); expect(head).not.toHaveBeenCalled();
    await act(async () => { await Promise.all([result.current.download(), result.current.download()]); });
    expect(info).toHaveBeenCalledTimes(1); expect(head).toHaveBeenCalledTimes(1); expect(get).not.toHaveBeenCalled();
    expect(result.current.downloads).toEqual([{ id: 1, path: "/api/v1/app-downloads/android/42/file" }]);
    await act(async () => { await result.current.download(); });
    expect(info).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.retry(); });
    expect(info).toHaveBeenCalledTimes(2); expect(head).toHaveBeenCalledTimes(2);
    expect(result.current.downloads).toHaveLength(2);
    expect(result.current.downloads[0].id).toBe(1);
  });

  test.each(["no_release", "withdrawn", "paused", "unavailable"])("信息 %s 不发文件请求", async (status) => {
    const { head } = handlers();
    server.use(http.get("*/api/v1/app-downloads/android", () => HttpResponse.json({ code: 0, data: { status, release: null, retryAfterSeconds: null } })));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(result.current.query.data?.info.status).toBe(status);
    expect(head).not.toHaveBeenCalled(); expect(result.current.downloads).toEqual([]);
  });

  test.each([429, 503, 502])("信息请求 %s 空正文保留 HTTP 状态与等待时间，不发 HEAD", async (status) => {
    const { head } = handlers();
    const info = vi.fn(() => new HttpResponse(null, { status, headers: { "Retry-After": "60" } }));
    server.use(http.get("*/api/v1/app-downloads/android", info));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(result.current.fileError).toMatchObject({ status }); expect(result.current.waiting).toBe(true);
    await act(async () => { await result.current.retry(); });
    expect(info).toHaveBeenCalledTimes(1); expect(head).not.toHaveBeenCalled();
  });

  test.each([429, 503, 502, 404])("HEAD %s 空正文不交接；明确重试重新读取推荐", async (status) => {
    const { info } = handlers();
    const head = vi.fn(() => new HttpResponse(null, { status }));
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", head));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(result.current.fileError).toMatchObject({ status }); expect(result.current.downloads).toEqual([]);
    expect(info).toHaveBeenCalledTimes(1); expect(head).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.retry(); });
    expect(info).toHaveBeenCalledTimes(2); expect(head).toHaveBeenCalledTimes(2);
  });

  test("Retry-After 到期只允许重试，不自动循环查询和传输", async () => {
    const { info } = handlers();
    const head = vi.fn(() => new HttpResponse(null, { status: 429, headers: { "Retry-After": "1" } }));
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", head));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(result.current.waiting).toBe(true);
    await waitFor(() => expect(result.current.waiting).toBe(false), { timeout: 2000 });
    expect(info).toHaveBeenCalledTimes(1); expect(head).toHaveBeenCalledTimes(1);
  });

  test("重试读取失败不沿用旧制品发 HEAD，也不移除已交接载体", async () => {
    const { head } = handlers();
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    server.use(http.get("*/api/v1/app-downloads/android", () => new HttpResponse(null, { status: 503 })));
    await act(async () => { await result.current.retry(); });
    expect(result.current.fileError).toMatchObject({ status: 503 });
    expect(head).toHaveBeenCalledTimes(1); expect(result.current.downloads).toHaveLength(1);
  });

  test("信息建议等待时不发 HEAD，未确认元数据也不交接", async () => {
    const { head } = handlers();
    server.use(http.get("*/api/v1/app-downloads/android", () => HttpResponse.json({ code: 0, data: { ...availableDownload(), retryAfterSeconds: 60 } })));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(result.current.waiting).toBe(true); expect(head).not.toHaveBeenCalled();
  });

  test("HEAD 元数据变化停止交接", async () => {
    handlers();
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", () => new HttpResponse(null, { headers: { ...downloadHeaders(), "x-amz-meta-version-code": "43" } })));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(result.current.fileError).toMatchObject({ status: 503 }); expect(result.current.downloads).toEqual([]);
  });

  test.each([false, true])("推荐变化或应用卸载取消预检交接：unmount=%s", async (unmountApp) => {
    handlers(); let complete!: () => void; const entered = vi.fn();
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", async () => {
      entered(); await new Promise<void>((resolve) => { complete = resolve; });
      return new HttpResponse(null, { headers: downloadHeaders() });
    }));
    const client = createTestQueryClient();
    const { result, unmount } = renderHook(useAppDownload, { wrapper: createQueryWrapper(client).Wrapper });
    let action!: Promise<void>;
    act(() => { action = result.current.download(); });
    await waitFor(() => expect(entered).toHaveBeenCalled());
    if (unmountApp) unmount();
    else act(() => client.setQueryData(queryKeys.appDownloads.android, { info: availableDownload(43), retryAt: null }));
    await act(async () => { complete(); await action; });
    expect(result.current.downloads).toEqual([]);
    if (!unmountApp) expect(result.current.fileError).toMatchObject({ status: 409 });
  });
});
