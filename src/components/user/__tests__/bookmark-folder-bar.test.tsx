import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { BookmarkFolderBar } from "../bookmark-folder-bar";

vi.mock("../create-bookmark-folder-button", () => ({
  CreateBookmarkFolderButton: ({ onCreated }: { onCreated: (folder: { id: string }) => void }) => <button onClick={() => onCreated({ id: "new-folder" })}>新建收藏夹</button>,
}));
afterEach(cleanup);

test("100 个收藏夹可搜索、选择；无结果不改变选择，新建清除搜索", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const folders = Array.from({ length: 100 }, (_, index) => ({ id: `f-${index}`, name: `跑团资料 ${index}`, itemCount: 2, isDefault: index === 0, createdAt: "2026-09-01" }));
  render(<BookmarkFolderBar folders={folders} onSelect={onSelect} selectedFolderId="f-0" />);
  expect(screen.getAllByRole("button")).toHaveLength(102);
  await user.type(screen.getByRole("searchbox"), "资料 99");
  await user.click(screen.getByRole("button", { name: /跑团资料 99/ }));
  expect(onSelect).toHaveBeenLastCalledWith("f-99");
  await user.clear(screen.getByRole("searchbox"));
  await user.type(screen.getByRole("searchbox"), "不存在");
  expect(screen.getByText("没有匹配的收藏夹")).toBeInTheDocument();
  expect(onSelect).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "新建收藏夹" }));
  expect(onSelect).toHaveBeenLastCalledWith("new-folder");
  expect(screen.getByRole("searchbox")).toHaveValue("");
});
