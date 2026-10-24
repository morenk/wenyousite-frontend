import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FontOrderSnapshot } from "@/api/hooks/admin/use-admin-font-management";
import { TextFontOrderPanel } from "../text-font-order-panel";
const env = vi.hoisted(() => ({ data: undefined as FontOrderSnapshot | undefined, readFailed: false, save: vi.fn(), reload: vi.fn() }));
vi.mock("@/api/hooks/admin/use-admin-font-management", async (original) => ({ ...await original<object>(),
  useAdminFontOrder: () => ({ data: env.data, isError: env.readFailed, isFetching: false, refetch: env.reload }),
  useSaveAdminFontOrder: () => ({ mutateAsync: env.save }),
}));
vi.mock("@/api/hooks/use-admin", () => ({ useAdminSession: () => ({ sessionStatus: "authenticated" }) }));
const snapshot = (revision = 7): FontOrderSnapshot => ({ catalogRevision: revision, listingRevision: revision, items: ["甲", "乙"].map((name, index) => ({ name, familyId: name, language: "zh", revision: revision + index, enabled: true, status: "enabled", currentVersionId: "version", lastPublishedVersionId: "version", sortOrder: index, createdAt: "", updatedAt: "", publishedAt: null, withdrawnAt: null, latestJob: null, latestSubmissionId: null })) });
beforeEach(() => { vi.clearAllMocks(); env.readFailed = false; env.data = snapshot(); });
afterEach(cleanup);
test.each([{ code: 40928 }, new TypeError("lost response")])("冲突或未知结果禁止补偿写入，重新加载完整集合后重排（%j）", async (error) => {
  const close = vi.fn(); env.save.mockRejectedValueOnce(error); env.reload.mockResolvedValue({ data: snapshot(11), isError: false });
  render(<TextFontOrderPanel onClose={close} />);
  fireEvent.click(screen.getByRole("button", { name: "乙置顶" })); fireEvent.click(screen.getByRole("button", { name: "保存顺序" }));
  await screen.findByRole("button", { name: "读取最新顺序" });
  expect(screen.getByText(error instanceof TypeError ? "保存结果未确认，请读取最新顺序。" : "目录已更新，请读取最新顺序后重排。")).toBeVisible();
  expect(env.save).toHaveBeenCalledExactlyOnceWith({ expectedCatalogRevision: 7, groups: [{ language: "zh", items: [{ familyId: "乙", expectedFamilyRevision: 8 }, { familyId: "甲", expectedFamilyRevision: 7 }] }] });
  expect(screen.getByRole("button", { name: "甲置顶" })).toBeDisabled(); expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "读取最新顺序" }));
  await waitFor(() => expect(screen.getByRole("listitem", { name: "甲，第 1 位" })).toBeVisible());
  expect(screen.getByRole("button", { name: "保存顺序" })).toBeDisabled();
  env.save.mockResolvedValueOnce({}); fireEvent.click(screen.getByRole("button", { name: "乙置顶" })); fireEvent.click(screen.getByRole("button", { name: "保存顺序" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce()); expect(env.save.mock.calls[1]![0].expectedCatalogRevision).toBe(11);
});

test("完整集合首次读取失败停止loading，保留重试和返回", () => {
  env.data = undefined; env.readFailed = true;
  render(<TextFontOrderPanel onClose={vi.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("完整顺序读取失败");
  expect(screen.queryByText("正在读取完整顺序…")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "重试" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "返回列表" })).toBeEnabled();
});
test("确定失败保留草稿供重试，不误报目录变化或自动重载", async () => {
  env.save.mockRejectedValueOnce({ status: 400, code: 40001, message: "请求未被接受" });
  render(<TextFontOrderPanel onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "乙置顶" })); fireEvent.click(screen.getByRole("button", { name: "保存顺序" }));
  await screen.findByText("请求未被接受");
  expect(screen.queryByRole("button", { name: "读取最新顺序" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存顺序" })).toBeEnabled(); expect(env.reload).not.toHaveBeenCalled();
});
