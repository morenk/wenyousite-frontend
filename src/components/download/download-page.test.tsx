import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DownloadPage } from "./download-page";
import { server } from "@/test/msw/server";
import { createQueryWrapper } from "@/test/query-client";
import { availableDownload, downloadHeaders } from "@/test/app-download";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderPage(data: unknown, status = 200, headers: Record<string, string> = {}) {
  server.use(http.get("*/api/v1/app-downloads/android", () => HttpResponse.json({ code: status === 200 ? 0 : 50300, data }, { status, headers })));
  return render(<DownloadPage />, { wrapper: createQueryWrapper().Wrapper });
}

describe("下载页真实 Hook 与视图接入", () => {
  test.each([
    ["no_release", "暂无推荐版本"], ["withdrawn", "此版本已撤回"],
    ["paused", "下载已暂停"], ["unavailable", "下载暂不可用"],
  ])("info-%s 明确显示状态，保留页面二维码并禁止下载", async (status, title) => {
    renderPage({ status, release: null, retryAfterSeconds: null });
    expect(await screen.findByText(title)).toBeVisible();
    expect(screen.getByRole("button", { name: "下载 Android 安装包" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "wenyou.site/download" })).toHaveAttribute("href", "https://wenyou.site/download");
    expect(screen.queryByText("32.0 MiB")).toBeNull();
  });

  test.each([503, 429])("信息请求 %s 与明确无发布区分，带 Retry-After 时禁止重试", async (status) => {
    renderPage(null, status, { "Retry-After": "60" });
    expect(await screen.findByText(status === 429 ? "下载请求较多" : "下载信息加载失败")).toBeVisible();
    expect(screen.getByRole("button", { name: "重新获取下载信息" })).toBeDisabled();
    expect(screen.queryByText("暂无推荐版本")).toBeNull();
  });

  test.each([429, 503, 502])("信息请求 %s 空正文按 HTTP 状态恢复，不自动重试", async (status) => {
    const info = vi.fn(() => new HttpResponse(null, { status, headers: { "Retry-After": "60" } }));
    server.use(http.get("*/api/v1/app-downloads/android", info));
    render(<DownloadPage />, { wrapper: createQueryWrapper().Wrapper });
    expect(await screen.findByText(status === 429 ? "下载请求较多" : "下载信息加载失败")).toBeVisible();
    expect(screen.getByRole("button", { name: "重新获取下载信息" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下载 Android 安装包" })).toBeDisabled();
    expect(screen.queryByText("暂无推荐版本")).toBeNull();
    expect(info).toHaveBeenCalledTimes(1);
  });

  test("info-paused 额度暂停遵守建议等待时间，不推测恢复时刻", async () => {
    renderPage({ status: "paused", release: null, retryAfterSeconds: 60 });
    expect(await screen.findByText("下载已暂停")).toBeVisible();
    expect(screen.getByRole("button", { name: "下载 Android 安装包" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重新获取下载信息" })).toBeDisabled();
    expect(screen.getByText("请稍后重试，等待结束后可重新获取下载信息。")).toBeVisible();
  });

  test.each([null, { status: "available", release: null, retryAfterSeconds: null },
    { ...availableDownload(), release: { ...availableDownload().release, downloadUrl: "https://bucket.example/app.apk" } },
  ])("缺失或不可信响应不可冒充成功", async (data) => {
    renderPage(data);
    expect(await screen.findByText("下载信息加载失败")).toBeVisible();
    expect(screen.getByRole("button", { name: "下载 Android 安装包" })).toBeDisabled();
  });

  test("info-available / download-browser-handoff 只陈述浏览器交接，不声称已完成安装", async () => {
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", () => new HttpResponse(null, { headers: downloadHeaders() })));
    server.use(http.get("*/api/v1/app-downloads/android/:build/file", () => HttpResponse.text("isolated-download-fixture")));
    renderPage(availableDownload());
    expect(await screen.findByText("32.0 MiB")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "下载 Android 安装包" }));
    expect(await screen.findByText("已交给浏览器下载，请在下载列表查看。若未开始，请稍后重新获取下载信息再试。")).toBeVisible();
    expect(screen.getByTitle("Android 安装包下载")).toHaveAttribute("src", "/api/v1/app-downloads/android/42/file");
    expect(screen.getByTitle("Android 安装包下载")).toHaveAttribute("sandbox", "allow-downloads allow-same-origin");
    await waitFor(() => expect((screen.getByTitle("Android 安装包下载") as HTMLIFrameElement).contentDocument?.body.textContent).toBe("isolated-download-fixture"));
    expect(screen.getByRole("button", { name: "下载 Android 安装包" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重新获取下载信息" })).toBeEnabled();
  });

  test("HEAD 身份不匹配时失败关闭，信息刷新不重试文件", async () => {
    const head = vi.fn(() => new HttpResponse(null, { headers: { ...downloadHeaders(), "x-amz-meta-version-code": "43" } }));
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", head));
    renderPage(availableDownload());
    await screen.findByText("32.0 MiB");
    await userEvent.click(screen.getByRole("button", { name: "下载 Android 安装包" }));
    expect(await screen.findByText("下载暂不可用")).toBeVisible();
    expect(screen.queryByTitle("Android 安装包下载")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重新获取下载信息" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "下载 Android 安装包" })).toBeEnabled());
    expect(head).toHaveBeenCalledTimes(1);
  });

  test("available 带建议等待时间时保留版本但暂停下载与手动刷新", async () => {
    renderPage({ ...availableDownload(), retryAfterSeconds: 60 });
    await screen.findByText("32.0 MiB");
    expect(screen.getByRole("button", { name: "下载 Android 安装包" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重新获取下载信息" })).toBeDisabled();
  });
});
