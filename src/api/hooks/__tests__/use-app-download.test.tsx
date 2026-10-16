import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useAppDownload } from "@/api/hooks/use-app-download";
import * as authStore from "@/lib/auth-store";
import { queryKeys } from "@/api/query-keys";
import { availableDownload, downloadHeaders } from "@/test/app-download";
import { server } from "@/test/msw/server";
import { createQueryWrapper, createTestQueryClient } from "@/test/query-client";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function handlers() {
  const info = vi.fn(() => HttpResponse.json({ code: 0, data: availableDownload() }));
  const head = vi.fn(() => new HttpResponse(null, { headers: downloadHeaders() }));
  const get = vi.fn(() => new HttpResponse(null));
  server.use(http.get("*/api/v1/mobile-releases/android/download", info), http.head("https://wenyou-apk.cn-nb1.rains3.com/mobile/android/:file", head), http.get("https://wenyou-apk.cn-nb1.rains3.com/mobile/android/:file", get));
  return { info, head, get };
}

describe("点击一次获取信息、核验并交接下载", () => {
  test("信息走同域 API；桶 HEAD 不带凭据、认证或本站请求头", async () => {
    vi.spyOn(authStore, "getAuthAccessToken").mockReturnValue("isolated-download-token");
    const modes: RequestCredentials[] = [];
    const external: Request[] = [];
    server.use(
      http.get("*/api/v1/mobile-releases/android/download", ({ request }) => { modes.push(request.credentials); return HttpResponse.json({ code: 0, data: availableDownload() }); }),
      http.head("https://wenyou-apk.cn-nb1.rains3.com/mobile/android/:file", ({ request }) => { modes.push(request.credentials); external.push(request); return new HttpResponse(null, { headers: downloadHeaders() }); }),
    );
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(modes).toEqual(["same-origin", "omit"]);
    expect(external[0].headers.has("authorization")).toBe(false);
    expect(external[0].headers.has("cookie")).toBe(false);
    expect(external[0].headers.has("x-client-platform")).toBe(false);
    expect(external[0].headers.has("x-markdown-contract-version")).toBe(false);
    expect(external[0].headers.has("range")).toBe(false);
    expect(external[0].redirect).toBe("error");
    expect(external[0].referrerPolicy).toBe("no-referrer");
    expect(result.current.downloads).toHaveLength(1);
  });

  test("挂载不请求信息/文件，一次点击串行查询与 HEAD，连续点击不会重复交接", async () => {
    const { info, head, get } = handlers();
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    expect(info).not.toHaveBeenCalled(); expect(head).not.toHaveBeenCalled();
    await act(async () => { await Promise.all([result.current.download(), result.current.download()]); });
    expect(info).toHaveBeenCalledTimes(1); expect(head).toHaveBeenCalledTimes(1); expect(get).not.toHaveBeenCalled();
    expect(result.current.downloads).toEqual([{ id: 1, url: availableDownload().release!.downloadUrl }]);
    await act(async () => { await result.current.download(); });
    expect(info).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.retry(); });
    expect(info).toHaveBeenCalledTimes(2); expect(head).toHaveBeenCalledTimes(2);
    expect(result.current.downloads).toHaveLength(2);
    expect(result.current.downloads[0].id).toBe(1);
  });

  test.each(["no_release", "unavailable"])("信息 %s 不发文件请求", async (status) => {
    const { head } = handlers();
    server.use(http.get("*/api/v1/mobile-releases/android/download", () => HttpResponse.json({ code: 0, data: { status, release: null, retryAfterSeconds: null } })));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(result.current.query.data?.info.status).toBe(status);
    expect(head).not.toHaveBeenCalled(); expect(result.current.downloads).toEqual([]);
  });

  test.each([429, 503, 502])("信息请求 %s 空正文保留 HTTP 状态与等待时间，不发 HEAD", async (status) => {
    const { head } = handlers();
    const info = vi.fn(() => new HttpResponse(null, { status, headers: { "Retry-After": "60" } }));
    server.use(http.get("*/api/v1/mobile-releases/android/download", info));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(result.current.fileError).toMatchObject({ status }); expect(result.current.waiting).toBe(true);
    await act(async () => { await result.current.retry(); });
    expect(info).toHaveBeenCalledTimes(1); expect(head).not.toHaveBeenCalled();
  });

  test.each([429, 503, 502, 404])("HEAD %s 空正文不交接；明确重试重新读取推荐", async (status) => {
    const { info } = handlers();
    const head = vi.fn(() => new HttpResponse(null, { status }));
    server.use(http.head("https://wenyou-apk.cn-nb1.rains3.com/mobile/android/:file", head));
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
    server.use(http.head("https://wenyou-apk.cn-nb1.rains3.com/mobile/android/:file", head));
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
    server.use(http.get("*/api/v1/mobile-releases/android/download", () => new HttpResponse(null, { status: 503 })));
    await act(async () => { await result.current.retry(); });
    expect(result.current.fileError).toMatchObject({ status: 503 });
    expect(head).toHaveBeenCalledTimes(1); expect(result.current.downloads).toHaveLength(1);
  });

  test("新信息入口拒绝旧 retryAfterSeconds 语义，不发 HEAD", async () => {
    const { head } = handlers();
    server.use(http.get("*/api/v1/mobile-releases/android/download", () => HttpResponse.json({ code: 0, data: { ...availableDownload(), retryAfterSeconds: 60 } })));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(result.current.fileError).toBeInstanceOf(Error); expect(head).not.toHaveBeenCalled();
  });

  test("信息仍指向网关时拒绝交接，不请求网关或猜测桶地址", async () => {
    const { head, get } = handlers();
    const info = availableDownload();
    info.release!.downloadUrl = "https://wenyou.site/api/v1/app-downloads/android/42/file";
    server.use(http.get("*/api/v1/mobile-releases/android/download", () => HttpResponse.json({ code: 0, data: info })));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(result.current.fileError).toBeInstanceOf(Error);
    expect(head).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled();
    expect(result.current.downloads).toEqual([]);
  });

  test("桶 CORS 或网络失败保留手动恢复，不回退也不自动重试", async () => {
    const { info, get } = handlers();
    const head = vi.fn(() => HttpResponse.error());
    server.use(http.head("https://wenyou-apk.cn-nb1.rains3.com/mobile/android/:file", head));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(result.current.fileError).toBeInstanceOf(Error);
    expect(result.current.downloads).toEqual([]);
    expect(info).toHaveBeenCalledTimes(1); expect(head).toHaveBeenCalledTimes(1); expect(get).not.toHaveBeenCalled();
  });

  test("HEAD 元数据变化停止交接", async () => {
    handlers();
    server.use(http.head("https://wenyou-apk.cn-nb1.rains3.com/mobile/android/:file", () => new HttpResponse(null, { headers: { ...downloadHeaders(), "x-amz-meta-version-code": "43" } })));
    const { result } = renderHook(useAppDownload, { wrapper: createQueryWrapper().Wrapper });
    await act(async () => { await result.current.download(); });
    expect(result.current.fileError).toMatchObject({ status: 503 }); expect(result.current.downloads).toEqual([]);
  });

  test.each([false, true])("推荐变化或应用卸载取消预检交接：unmount=%s", async (unmountApp) => {
    handlers(); let complete!: () => void; const entered = vi.fn();
    server.use(http.head("https://wenyou-apk.cn-nb1.rains3.com/mobile/android/:file", async () => {
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
