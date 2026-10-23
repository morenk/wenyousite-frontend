import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TextFontListView, defaultFontListFilters, type FontListRow } from "../text-font-list-view";
afterEach(cleanup);
const rows: FontListRow[] = [{ id: "font1", name: "服务端字体", language: "zh", status: "withdrawn" }];
const props = () => ({ filters: defaultFontListFilters, onFiltersChange: vi.fn(), rows, page: 1, hasNext: true, loading: false, error: false, onRetry: vi.fn(), onPageChange: vi.fn(), onReorder: vi.fn() });
test("默认最近新增降序，筛选与分页只通知上层，不在当前页本地伪过滤", () => {
  const state = props(); render(<TextFontListView {...state} />);
  expect(screen.getByRole("combobox", { name: "排序" })).toHaveTextContent("最近新增");
  fireEvent.change(screen.getByRole("textbox", { name: "名称搜索" }), { target: { value: "找其他字体" } });
  expect(state.onFiltersChange).toHaveBeenCalledWith({ ...defaultFontListFilters, search: "找其他字体" });
  expect(screen.getByText("服务端字体")).toBeVisible();
  expect(screen.getByText("已撤回")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "下一页" }));
  expect(state.onPageChange).toHaveBeenCalledWith(2);
  fireEvent.click(screen.getByRole("button", { name: "降序排列，切换为升序" }));
  expect(state.onFiltersChange).toHaveBeenCalledWith({ ...defaultFontListFilters, direction: "asc" });
});
test("读取失败不冒充空结果或展示过期列表，可显式重试", () => {
  const state = props(); render(<TextFontListView {...state} error />);
  expect(screen.getByRole("alert")).toHaveTextContent("字体列表读取失败");
  expect(screen.queryByText("服务端字体")).not.toBeInTheDocument();
  expect(screen.queryByText("暂无字体")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "重试" }));expect(state.onRetry).toHaveBeenCalledOnce();
});
test("筛选无结果与初始空列表分开，读取期间阻止分页", () => {
  const state = props(); const view = render(<TextFontListView {...state} rows={[]} filters={{ ...state.filters, search: "找不到" }} />);
  expect(screen.getByText("没有符合条件的字体")).toBeVisible();
  view.rerender(<TextFontListView {...state} rows={[]} />);
  expect(screen.getByText("暂无字体")).toBeVisible();
  view.rerender(<TextFontListView {...state} busy />);
  expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
});

test("处理进度独立于发布状态显示，短列不换行，最新提交进入详情可恢复", () => {
  render(<TextFontListView {...props()} rows={[{ ...rows[0]!, status: "enabled", processing: "failed", submissionId: "submission-id" }]} />);
  expect(screen.getByText("启用")).toBeVisible();
  expect(screen.getByText("处理失败")).toHaveClass("whitespace-nowrap");
  expect(screen.getByRole("link", { name: "管理" })).toHaveAttribute("href", "/station/text-fonts/font1?submission=submission-id");
});
