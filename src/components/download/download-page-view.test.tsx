import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { DownloadPageView, type DownloadAvailability } from "./download-page-view";

afterEach(cleanup);

const release = { versionLabel: "1.2.3", buildLabel: "123", sizeLabel: "32 MiB" };
const pageUrl = "https://wenyou.site/download";

describe("公开下载页视图", () => {
  test("匿名可查看版本、大小、构建号与安装说明，挂载和悬停不开始下载", async () => {
    const onDownload = vi.fn();
    const { container } = render(<DownloadPageView availability="ready" release={release} pageUrl={pageUrl} onDownload={onDownload} />);
    expect(screen.getByRole("heading", { name: "下载 APP" })).toBeVisible();
    expect(screen.getByText("1.2.3")).toBeVisible();
    expect(screen.getByText("32 MiB")).toBeVisible();
    expect(screen.getByText("123")).toBeVisible();
    expect(screen.getByRole("heading", { name: "安装说明" })).toBeVisible();
    expect(screen.getByRole("img", { name: "用手机打开温油站下载页" }).tagName).toBe("svg");
    expect(container.querySelector('img[src^="http"]')).toBeNull();
    expect(container.querySelector('a[href*="/file"]')).toBeNull();
    const button = screen.getByRole("button", { name: "下载 Android 安装包" });
    await userEvent.hover(button);
    expect(onDownload).not.toHaveBeenCalled();
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  test("确认下载期间禁用按钮，避免重复请求", async () => {
    const onDownload = vi.fn();
    render(<DownloadPageView availability="ready" release={release} onDownload={onDownload} pending />);
    const button = screen.getByRole("button", { name: "正在确认下载…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onDownload).not.toHaveBeenCalled();
  });

  test.each<[DownloadAvailability, string]>([
    ["empty", "暂无推荐版本"],
    ["withdrawn", "此版本已撤回"],
    ["paused", "下载已暂停"],
    ["unavailable", "下载暂不可用"],
    ["rate-limited", "下载请求较多"],
    ["error", "下载信息加载失败"],
  ])("%s 状态不会保留可点击的旧安装包", async (availability, title) => {
    const onDownload = vi.fn();
    const onRetry = vi.fn();
    render(<DownloadPageView availability={availability} release={release} onDownload={onDownload} onRetry={onRetry} />);
    expect(screen.getByText(title)).toBeVisible();
    const button = screen.getByRole("button", { name: "下载 Android 安装包" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onDownload).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "重新获取下载信息" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("加载、重试与缺失版本时保持不可下载", () => {
    const view = render(<DownloadPageView availability="loading" />);
    expect(screen.getByRole("status", { name: "正在获取下载信息…" })).toBeVisible();
    expect(screen.getByRole("button", { name: "下载 Android 安装包" })).toBeDisabled();
    view.rerender(<DownloadPageView availability="ready" onDownload={vi.fn()} />);
    expect(screen.getByRole("button", { name: "下载 Android 安装包" })).toBeDisabled();
    view.rerender(<DownloadPageView availability="error" onRetry={vi.fn()} retryPending feedback="请稍后重试。" />);
    expect(screen.getByRole("button", { name: "正在刷新…" })).toBeDisabled();
    expect(screen.getByText("请稍后重试。")).toHaveAttribute("role", "status");
  });
});
