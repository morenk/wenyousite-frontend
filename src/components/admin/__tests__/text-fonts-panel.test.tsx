import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FontManagementQuery } from "@/api/hooks/admin/use-admin-font-management";
import { TextFontsPanel } from "../text-fonts-panel";
const env = vi.hoisted(() => ({ stale: false, read: vi.fn() }));
vi.mock("@/api/hooks/admin/use-admin-font-management", () => ({ useAdminFontManagement: (query: FontManagementQuery) => env.read(query) }));
vi.mock("../text-font-order-panel", () => ({ TextFontOrderPanel: () => <p>完整顺序模式</p> }));
beforeEach(() => {
  env.stale = false; env.read.mockReset();
  env.read.mockImplementation((query: FontManagementQuery) => ({
    data: { items: [{ familyId: "font", name: query.cursor ? "第21条字体" : "第1条字体", language: "zh", status: "withdrawn", currentVersionId: null }], nextCursor: query.cursor ? null : "page2" },
    isError: env.stale && Boolean(query.cursor), error: { code: 40931 }, isLoading: false, isFetching: false, refetch: vi.fn(),
  }));
});
afterEach(cleanup);
test("URL恢复筛选和排序，翻页后改变筛选回到第一页且更新URL", async () => {
  const onUrlUpdate = vi.fn();
  render(<NuqsTestingAdapter searchParams="?search=名称&language=zh&status=withdrawn&sort=name&direction=asc" hasMemory onUrlUpdate={onUrlUpdate}><TextFontsPanel /></NuqsTestingAdapter>);
  expect(env.read).toHaveBeenLastCalledWith({ q: "名称", language: "zh", status: "withdrawn", sort: "name", direction: "asc", cursor: undefined });
  fireEvent.click(screen.getByRole("button", { name: "下一页" })); expect(screen.getByText("第21条字体")).toBeVisible();
  fireEvent.change(screen.getByRole("textbox", { name: "名称搜索" }), { target: { value: "新条件" } });
  await waitFor(() => expect(env.read).toHaveBeenLastCalledWith(expect.objectContaining({ q: "新条件", cursor: undefined })));
  expect(screen.getByText("第1条字体")).toBeVisible(); expect(onUrlUpdate).toHaveBeenCalled();
});
test("40931保留URL筛选，抛弃过期游标并从第一页读取", () => {
  env.stale = true;
  render(<NuqsTestingAdapter searchParams="?search=保留&sort=updated" hasMemory><TextFontsPanel /></NuqsTestingAdapter>);
  fireEvent.click(screen.getByRole("button", { name: "下一页" }));
  expect(env.read).toHaveBeenCalledWith(expect.objectContaining({ cursor: "page2" }));
  expect(env.read).toHaveBeenLastCalledWith(expect.objectContaining({ q: "保留", sort: "updatedAt", cursor: undefined }));
  expect(screen.getByRole("textbox", { name: "名称搜索" })).toHaveValue("保留");
  expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
});
test("展示顺序进入独立模式，不把搜索结果直接传作排序集合", () => {
  render(<NuqsTestingAdapter searchParams="?search=只命中一项" hasMemory><TextFontsPanel /></NuqsTestingAdapter>);
  fireEvent.click(screen.getByRole("button", { name: "调整展示顺序" }));
  expect(screen.getByText("完整顺序模式")).toBeVisible(); expect(screen.queryByRole("textbox", { name: "名称搜索" })).not.toBeInTheDocument();
});
