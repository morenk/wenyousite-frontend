import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileReleasesTable, type MobileReleaseTableRow } from "./mobile-releases-table";

const row: MobileReleaseTableRow = {
  id: "release-1", platform: "Android", version: "1.2.0", build: 42,
  state: "已发布", pendingRevision: true, summary: "阅读体验改进", updatedAt: "2026-09-26T08:00:00Z",
};

describe("移动端版本列表展示", () => {
  afterEach(cleanup);

  it.each([
    { loading: true, failed: false, text: "正在读取移动端版本…" },
    { loading: false, failed: true, text: "移动端版本加载失败" },
    { loading: false, failed: false, text: "当前筛选下没有移动端版本" },
  ])("列表状态：$text", ({ loading, failed, text }) => {
    const retry = vi.fn();
    render(<MobileReleasesTable rows={[]} loading={loading} failed={failed} busy={loading} onRetry={retry} onOpen={vi.fn()} />);
    expect(screen.getByRole("table", { name: "移动端版本列表" })).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
    if (failed) {
      fireEvent.click(screen.getByRole("button", { name: "重试" }));
      expect(retry).toHaveBeenCalledOnce();
    }
  });

  it("已发布记录仍显示待修订状态，查看返回所选记录", () => {
    const open = vi.fn();
    render(<MobileReleasesTable rows={[row]} loading={false} failed={false} busy={false} onRetry={vi.fn()} onOpen={open} />);
    for (const value of ["Android", "1.2.0", "构建 42", "已发布", "待修订确认", "阅读体验改进"]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "查看" }));
    expect(open).toHaveBeenCalledWith("release-1");
  });

  it("重新读取期间禁用旧数据操作，读取失败不展示陈旧成功列表", () => {
    const props = { rows: [row], loading: false, onRetry: vi.fn(), onOpen: vi.fn() };
    const view = render(<MobileReleasesTable {...props} failed={false} busy />);
    expect(screen.getByRole("button", { name: "查看" })).toBeDisabled();
    view.rerender(<MobileReleasesTable {...props} failed busy={false} />);
    expect(screen.queryByText("1.2.0")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeEnabled();
  });
});
