import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { ThemeMenu } from "@/components/layout/theme-menu";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AppDownloadProvider } from "./app-download-provider";
import { DOWNLOAD_PROMPT_SESSION_KEY } from "./mobile-download-prompt";
import { server } from "@/test/msw/server";
import { availableDownload, downloadHeaders } from "@/test/app-download";

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Scene({ menu = true }: { menu?: boolean }) {
  return <ThemeProvider><AppDownloadProvider>{menu ? <ThemeMenu /> : <p>其他页面</p>}</AppDownloadProvider></ThemeProvider>;
}
function handlers() {
  const info = vi.fn(() => HttpResponse.json({ code: 0, data: availableDownload() }));
  const head = vi.fn(() => new HttpResponse(null, { headers: downloadHeaders() }));
  const get = vi.fn(() => HttpResponse.text("isolated-download"));
  server.use(http.get("*/api/v1/app-downloads/android", info), http.head("*/api/v1/app-downloads/android/:build/file", head), http.get("*/api/v1/app-downloads/android/:build/file", get));
  return { info, head, get };
}
async function openMenu() { await userEvent.click(screen.getByRole("button", { name: "外观：跟随系统" })); }
async function loadedFrame(id = 1) {
  await waitFor(() => expect((screen.getByTitle(`Android 安装包下载 ${id}`) as HTMLIFrameElement).contentDocument?.body.textContent).toBe("isolated-download"));
  return screen.getByTitle(`Android 安装包下载 ${id}`);
}
function mobile(platform: "android" | "ios" | "other") {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(platform === "android" ? "Mozilla/5.0 (Linux; Android 15) Mobile" : platform === "ios" ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" : "Mozilla/5.0 Mobile OtherOS");
}

describe("菜单下载与应用级生命周期", () => {
  test("打开/悬停/聚焦不请求；点击一次完成查询和交接，关闭与卸载菜单保留框架", async () => {
    const { info, head, get } = handlers();
    const view = render(<Scene />);
    await openMenu();
    const button = screen.getByRole("button", { name: "下载 APP" });
    await userEvent.hover(button); button.focus();
    expect(info).not.toHaveBeenCalled(); expect(head).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText(/已交给浏览器下载/)).toBeVisible();
    const frame = await loadedFrame();
    expect(button).toBeDisabled(); expect(info).toHaveBeenCalledTimes(1); expect(head).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(frame).toBeInTheDocument();
    view.rerender(<Scene menu={false} />);
    expect(frame).toBeInTheDocument();
    view.rerender(<Scene />); await openMenu();
    expect(screen.getByText(/已交给浏览器下载/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "重试下载" }));
    await loadedFrame(2);
    expect(screen.getByTitle("Android 安装包下载 1")).toBe(frame);
    expect(info).toHaveBeenCalledTimes(2); expect(get).toHaveBeenCalledTimes(2);
  });

  test("查询或 HEAD 期间卸载菜单不会中断用户已触发的流程", async () => {
    const { get } = handlers(); let complete!: () => void; const entered = vi.fn();
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", async () => { entered(); await new Promise<void>((r) => { complete = r; }); return new HttpResponse(null, { headers: downloadHeaders() }); }));
    const view = render(<Scene />); await openMenu();
    await userEvent.click(screen.getByRole("button", { name: "下载 APP" }));
    await waitFor(() => expect(entered).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "正在确认下载…" })).toBeDisabled();
    view.rerender(<Scene menu={false} />);
    await act(async () => complete()); await loadedFrame();
    expect(get).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["no_release", "暂无可下载版本"], ["withdrawn", "此版本已撤回"],
    ["paused", "下载已暂停"], ["unavailable", "安装包暂不可用"],
  ])("%s 状态在入口就近显示，明确重试才重新读取", async (status, message) => {
    const { head, get } = handlers();
    const info = vi.fn(() => HttpResponse.json({ code: 0, data: { status, release: null, retryAfterSeconds: null } }));
    server.use(http.get("*/api/v1/app-downloads/android", info));
    render(<Scene />); await openMenu(); await userEvent.click(screen.getByRole("button", { name: "下载 APP" }));
    expect(await screen.findByText(new RegExp(message))).toBeVisible(); expect(head).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "重试下载" }));
    await waitFor(() => expect(info).toHaveBeenCalledTimes(2));
  });

  test.each([429, 503, 502])("信息 %s 空正文错误就近提示并遵守等待时间", async (status) => {
    const { head } = handlers();
    server.use(http.get("*/api/v1/app-downloads/android", () => new HttpResponse(null, { status, headers: { "Retry-After": "60" } })));
    render(<Scene />); await openMenu(); await userEvent.click(screen.getByRole("button", { name: "下载 APP" }));
    expect(await screen.findByText(/等待结束后可重试/)).toBeVisible();
    expect(screen.getByRole("button", { name: "重试下载" })).toBeDisabled(); expect(head).not.toHaveBeenCalled();
  });
});

describe("移动设备首次访问提示", () => {
  test("桌面窄窗口不弹窗，不预取信息或文件", () => {
    const { info, head, get } = handlers(); vi.stubGlobal("innerWidth", 390);
    render(<Scene />);
    expect(screen.queryByRole("dialog")).toBeNull(); expect(info).not.toHaveBeenCalled(); expect(head).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled();
  });

  test.each(["android", "ios", "other"] as const)("%s 自动提示可关闭，会话中重新挂载不再提示；关闭不下载", async (platform) => {
    mobile(platform); const { info, head, get } = handlers();
    const view = render(<Scene />);
    const dialog = await screen.findByRole("dialog", { name: "温油站 APP" });
    expect(within(dialog).getByText(/目前仅支持 Android/)).toBeVisible();
    if (platform !== "android") expect(within(dialog).queryByRole("button", { name: "下载 APP" })).toBeNull();
    if (platform === "other") expect(within(dialog).queryByText(/iOS/)).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "关闭下载提示" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sessionStorage.getItem(DOWNLOAD_PROMPT_SESSION_KEY)).toBe("handled");
    view.unmount(); render(<Scene />);
    expect(screen.queryByRole("dialog")).toBeNull(); expect(info).not.toHaveBeenCalled(); expect(head).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled();
  });

  test("Android 弹窗与菜单共享请求和载体，关闭弹窗后仍能完成下载", async () => {
    mobile("android"); const { info, get } = handlers();
    let complete!: () => void; const entered = vi.fn();
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", async () => { entered(); await new Promise<void>((r) => { complete = r; }); return new HttpResponse(null, { headers: downloadHeaders() }); }));
    render(<Scene />); const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "下载 APP" }));
    await waitFor(() => expect(entered).toHaveBeenCalled());
    expect(sessionStorage.getItem(DOWNLOAD_PROMPT_SESSION_KEY)).toBe("handled");
    await userEvent.keyboard("{Escape}"); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await openMenu(); expect(screen.getByRole("button", { name: "正在确认下载…" })).toBeDisabled();
    await act(async () => complete()); await loadedFrame();
    expect(info).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/已交给浏览器下载/)).toBeVisible();
  });

  test("拒绝 sessionStorage 时仍可关闭，当前应用路由重渲染不重复弹窗", async () => {
    mobile("android");
    vi.spyOn(sessionStorage, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(sessionStorage, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const view = render(<Scene />); await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "继续使用网页" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    view.rerender(<Scene menu={false} />);
    expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.getByText("其他页面")).toBeVisible();
  });

  test("Android 弹窗中的失败可明确重试，不需关闭后重新找入口", async () => {
    mobile("android"); const { get } = handlers();
    const head = vi.fn().mockImplementationOnce(() => new HttpResponse(null, { status: 503 })).mockImplementation(() => new HttpResponse(null, { headers: downloadHeaders() }));
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", head));
    render(<Scene />); const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "下载 APP" }));
    expect(await within(dialog).findByText("暂时无法下载，请重试。")).toBeVisible(); expect(get).not.toHaveBeenCalled();
    expect(within(dialog).queryByRole("button", { name: "下载 APP" })).toBeNull();
    expect(within(dialog).getAllByRole("button", { name: "重试下载" })).toHaveLength(1);
    await userEvent.click(within(dialog).getByRole("button", { name: "重试下载" }));
    await loadedFrame(); expect(get).toHaveBeenCalledTimes(1);
  });

  test("弹窗原位重试遵守等待时间；交接后的双击与长按不重复下载", async () => {
    mobile("android"); const { info, get } = handlers();
    const head = vi.fn().mockImplementationOnce(() => new HttpResponse(null, { status: 429, headers: { "Retry-After": "1" } }))
      .mockImplementation(() => new HttpResponse(null, { headers: downloadHeaders() }));
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", head));
    render(<Scene />); const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "下载 APP" }));
    const retry = await within(dialog).findByRole("button", { name: "重试下载" });
    expect(retry).toBeDisabled();
    await waitFor(() => expect(retry).toBeEnabled(), { timeout: 2000 });
    expect(info).toHaveBeenCalledTimes(1); expect(get).not.toHaveBeenCalled();
    await userEvent.click(retry); await loadedFrame();
    expect(info).toHaveBeenCalledTimes(2); expect(get).toHaveBeenCalledTimes(1);
    fireEvent.click(retry, { detail: 2 });
    expect(fireEvent.keyDown(retry, { key: "Enter", repeat: true })).toBe(false);
    expect(retry).toBeEnabled();
    expect(info).toHaveBeenCalledTimes(2); expect(get).toHaveBeenCalledTimes(1);
    await userEvent.click(retry); await loadedFrame(2);
    expect(info).toHaveBeenCalledTimes(3); expect(get).toHaveBeenCalledTimes(2);
  });
});

describe("服务端每日下载限制", () => {
  for (const entry of ["menu", "dialog"] as const) {
    for (const source of ["information", "HEAD"] as const) {
      test.each([
        ["device_daily_limit", "此浏览器今日下载次数已用完，请明日（北京时间）重试。"],
        ["ip_daily_limit", "当前 IP 今日下载次数已用完，请明日（北京时间）重试。"],
      ])(`${entry} / ${source} 空 429 的 %s 就近反馈，不发 APK GET`, async (reason, message) => {
        if (entry === "dialog") mobile("android");
        const { get } = handlers();
        const denied = vi.fn(() => new HttpResponse(null, { status: 429, headers: { "X-Download-Limit-Reason": reason, "Retry-After": "86400" } }));
        server.use(source === "information" ? http.get("*/api/v1/app-downloads/android", denied) : http.head("*/api/v1/app-downloads/android/:build/file", denied));
        render(<Scene />);
        if (entry === "menu") await openMenu();
        await userEvent.click(await screen.findByRole("button", { name: "下载 APP" }));
        expect(await screen.findByText(message)).toBeVisible();
        const retry = screen.getByRole("button", { name: "重试下载" });
        expect(retry).toBeDisabled();
        await userEvent.click(retry);
        expect(denied).toHaveBeenCalledTimes(1); expect(get).not.toHaveBeenCalled();
      });
    }
  }

  test.each([[429, "future_limit", "下载请求较多"], [503, "device_daily_limit", "暂时无法下载"]] as const)("未知或不适用原因 %s / %s 沿用通用反馈", async (status, reason, message) => {
    const { get } = handlers();
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", () => new HttpResponse(null, { status, headers: { "X-Download-Limit-Reason": reason } })));
    render(<Scene />); await openMenu(); await userEvent.click(screen.getByRole("button", { name: "下载 APP" }));
    expect(await screen.findByText(new RegExp(message))).toBeVisible();
    expect(screen.queryByText(/今日下载次数已用完/)).toBeNull(); expect(get).not.toHaveBeenCalled();
  });

  test("服务端等待到期只开放手动重试，重新确认信息与 HEAD 后才下载", async () => {
    mobile("android"); const { info, get } = handlers();
    const head = vi.fn().mockImplementationOnce(() => new HttpResponse(null, { status: 429, headers: { "X-Download-Limit-Reason": "device_daily_limit", "Retry-After": "1" } }))
      .mockImplementation(() => new HttpResponse(null, { headers: downloadHeaders() }));
    server.use(http.head("*/api/v1/app-downloads/android/:build/file", head));
    render(<Scene />); await userEvent.click(await screen.findByRole("button", { name: "下载 APP" }));
    expect(await screen.findByText(/此浏览器今日下载次数已用完/)).toBeVisible();
    const retry = screen.getByRole("button", { name: "重试下载" }); expect(retry).toBeDisabled();
    await waitFor(() => expect(retry).toBeEnabled(), { timeout: 2000 });
    expect(screen.getByText("已到重试时间，请手动重试下载。")).toBeVisible();
    expect(info).toHaveBeenCalledTimes(1); expect(head).toHaveBeenCalledTimes(1); expect(get).not.toHaveBeenCalled();
    await userEvent.click(retry); await loadedFrame();
    expect(info).toHaveBeenCalledTimes(2); expect(head).toHaveBeenCalledTimes(2); expect(get).toHaveBeenCalledTimes(1);
  });
});
