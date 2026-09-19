import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createRef } from "react";
import { BookmarkFolderManagement } from "../bookmark-folder-management";

const { rename, remove, success } = vi.hoisted(() => ({ rename: vi.fn(), remove: vi.fn(), success: vi.fn() }));
vi.mock("@/api/hooks/use-bookmark-folders", () => ({
  useRenameBookmarkFolder: () => ({ mutateAsync: rename, isPending: false }),
  useDeleteBookmarkFolder: () => ({ mutateAsync: remove, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success } }));
const folder = { id: "custom", name: "原名称", isDefault: false, itemCount: 2, createdAt: "2026-09-01" };
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
function setup(kind: "threads" | "moments" = "threads") {
  const onRenamed = vi.fn();
  const onDeleted = vi.fn();
  render(<BookmarkFolderManagement folder={folder} kind={kind} viewerScope="viewer" onRenamed={onRenamed} onDeleted={onDeleted} headingRef={createRef()} />);
  return { onRenamed, onDeleted, user: userEvent.setup() };
}
async function open(user: ReturnType<typeof userEvent.setup>, action: string) {
  await user.click(screen.getByRole("button", { name: "更多收藏夹操作：原名称" }));
  await user.click(screen.getByRole("menuitem", { name: action }));
}
test("键盘菜单方向键、Escape 和弹窗关闭归还焦点", async () => {
  const { user } = setup();
  const trigger = screen.getByRole("button", { name: "更多收藏夹操作：原名称" });
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await waitFor(() => expect(screen.getByRole("menuitem", { name: "重命名" })).toHaveFocus());
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("menuitem", { name: "删除收藏夹" })).toHaveFocus();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(trigger).toHaveFocus());
  await open(user, "重命名");
  const input = screen.getByRole("textbox", { name: "收藏夹名称" }) as HTMLInputElement;
  await waitFor(() => expect(input).toHaveFocus());
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(folder.name.length);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
});
for (const kind of ["threads", "moments"] as const) {
  test(`${kind} 重命名 trim、Enter、校验、失败保留输入与弹窗、成功无提示`, async () => {
    const { user, onRenamed } = setup(kind);
    rename.mockRejectedValueOnce({ code: 40900, message: "名称已存在" }).mockResolvedValueOnce({ ...folder, name: "新名称" });
    await open(user, "重命名");
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "   {Enter}");
    expect(await screen.findByText("请输入收藏夹名称")).toBeInTheDocument();
    expect(rename).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, "字".repeat(25) + "{Enter}");
    expect(await screen.findByText("名称最多 24 个字符")).toBeInTheDocument();
    expect(rename).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, "  新名称  {Enter}");
    expect(await screen.findByText("名称已存在")).toBeInTheDocument();
    expect(input).toHaveValue("  新名称  ");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onRenamed).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(rename).toHaveBeenLastCalledWith({ id: "custom", name: "新名称" });
    expect(onRenamed).toHaveBeenCalledOnce();
    expect(success).not.toHaveBeenCalled();
  });
  test.each(["rename", "delete"])(`${kind} %s 请求中禁用局部操作且 Escape 不关闭，失败不导航`, async (action) => {
    const { user, onDeleted, onRenamed } = setup(kind);
    let reject!: (error: unknown) => void;
    const mutation = action === "rename" ? rename : remove;
    mutation.mockImplementation(() => new Promise((_, rejectPromise) => { reject = rejectPromise; }));
    await open(user, action === "rename" ? "重命名" : "删除收藏夹");
    if (action === "delete") {
      expect(screen.getByText("收藏夹内的收藏会移到默认收藏夹，收藏内容不会删除。")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "删除收藏夹" })).toHaveClass("text-destructive");
    }
    await user.click(screen.getByRole("button", { name: action === "rename" ? "保存" : "删除收藏夹" }));
    expect(screen.getByRole("button", { name: action === "rename" ? "保存中" : "删除中" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    if (action === "rename") expect(screen.getByRole("textbox")).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => reject({ message: "服务暂不可用" }));
    expect(await screen.findByText("服务暂不可用")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onRenamed).not.toHaveBeenCalled();
    if (action === "delete") {
      remove.mockResolvedValueOnce({ deletedFolderId: "custom", destinationFolderId: "server-default" });
      await user.click(screen.getByRole("button", { name: "删除收藏夹" }));
      expect(onDeleted).toHaveBeenCalledWith("server-default");
      expect(success).toHaveBeenCalledOnce();
    }
  });
}

test("名称长度按 Unicode 字符计数，与后端一致", async () => {
  const { user, onRenamed } = setup();
  rename.mockResolvedValue({ ...folder, name: "🌷".repeat(24) });
  await open(user, "重命名");
  await user.clear(screen.getByRole("textbox"));
  await user.type(screen.getByRole("textbox"), "🌷".repeat(24) + "{Enter}");
  expect(rename).toHaveBeenCalledWith({ id: "custom", name: "🌷".repeat(24) });
  expect(onRenamed).toHaveBeenCalledOnce();
});
