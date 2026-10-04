
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ThreadIdentityControls } from "../thread-identity-controls";
import { ThreadIdentitySettings } from "../thread-identity-settings";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const mocks = vi.hoisted(() => ({ query: vi.fn(), save: vi.fn(), clear: vi.fn(), toggle: vi.fn(), confirm: vi.fn(), refetch: vi.fn(), error: vi.fn() }));
vi.mock("@/api/hooks/use-thread-identity", () => ({
  useThreadIdentity: () => mocks.query(),
  useUpdateThreadIdentity: () => ({ save: { mutateAsync: mocks.save }, clear: { mutateAsync: mocks.clear } }),
  useSetThreadIdentityEnabled: () => ({ mutateAsync: mocks.toggle, isPending: false }),
}));
vi.mock("@/components/ui/confirm-provider", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error } }));
vi.mock("@/components/user/avatar-uploader", async () => {
  const { SettingsDialog } = await import("@/components/user/settings-controls");
  return ({
  AvatarUploader: ({ onSaveAvatar, onRemoveAvatar, onClose }: { onSaveAvatar: (id: string) => unknown; onRemoveAvatar: () => unknown; onClose: () => void }) =>
    <SettingsDialog title="测试头像" onClose={onClose}><button onClick={() => onSaveAvatar("media1")}>保存测试头像</button><button onClick={onRemoveAvatar}>删除测试头像</button><button onClick={onClose}>关闭头像</button></SettingsDialog>,
  });
});
const state = { identity: { id: "rp1", nickname: "白鸦", avatarMediaId: "media-old", version: 3 }, display: { nickname: "白鸦", avatar: null },
  account: { id: "u1", username: "小明", avatar: null }, canEdit: true };
beforeEach(() => {
  vi.clearAllMocks(); mocks.query.mockReturnValue({ data: state, refetch: mocks.refetch });
  mocks.save.mockResolvedValue(state); mocks.clear.mockResolvedValue(state); mocks.toggle.mockResolvedValue(state); mocks.confirm.mockResolvedValue(true);
});
afterEach(cleanup);
test("资料面板分别保存昵称与本帖头像，携带版本，不调用全站头像", async () => {
  render(<ThreadIdentityControls threadId="t1" compact />);
  await userEvent.click(screen.getByRole("button", { name: /设置帖内身份/ }));
  await userEvent.click(screen.getByRole("button", { name: "设置帖内头像" }));
  await userEvent.click(screen.getByRole("button", { name: "保存测试头像" }));
  expect(mocks.save).toHaveBeenCalledWith({ avatarMediaId: "media1", version: 3 });
  await userEvent.click(screen.getByRole("button", { name: "删除测试头像" }));
  expect(mocks.save).toHaveBeenCalledWith({ clearAvatar: true, version: 3 });
  await userEvent.click(screen.getByRole("button", { name: "关闭头像" }));
  fireEvent.change(screen.getByLabelText("帖内昵称"), { target: { value: "夜渡" } });
  await userEvent.click(screen.getByRole("button", { name: "保存帖内身份" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ nickname: "夜渡", version: 3 }));
});
test("外部菜单打开面板可清除所有资料并关闭", async () => {
  const close = vi.fn();
  render(<ThreadIdentityControls threadId="t1" opened onClose={close} />);
  await userEvent.click(screen.getByRole("button", { name: "清除帖内资料" }));
  await waitFor(() => expect(mocks.clear).toHaveBeenCalledOnce());
  expect(close).toHaveBeenCalledOnce();
});
test("外部打开仍显示加载与错误，内部错误可重试，资格撤销保留已打开表单", async () => {
  mocks.query.mockReturnValue({ isPending: true });
  const view = render(<ThreadIdentityControls threadId="t1" opened />);
  expect(screen.getByRole("status")).toHaveTextContent("加载");
  mocks.query.mockReturnValue({ isError: true, refetch: mocks.refetch });
  view.rerender(<ThreadIdentityControls threadId="t1" opened />);
  await userEvent.click(screen.getByRole("button", { name: "身份加载失败，重试" }));
  expect(mocks.refetch).toHaveBeenCalledOnce();
  view.rerender(<ThreadIdentityControls threadId="t1" />);
  await userEvent.click(screen.getByRole("button", { name: "身份加载失败，重试" }));
  expect(mocks.refetch).toHaveBeenCalledTimes(2);
  mocks.query.mockReturnValue({ data: { ...state, canEdit: false } });
  view.rerender(<ThreadIdentityControls threadId="t1" opened />);
  expect(screen.getByLabelText("帖内昵称")).toHaveValue("白鸦");
  expect(screen.getByRole("button", { name: "保存帖内身份" })).toBeDisabled();
});
test("启用立即写入，关闭须确认，取消和失败保留原状态", async () => {
  const view = render(<ThreadIdentitySettings threadId="t1" enabled={false} />);
  await userEvent.click(screen.getByRole("button", { name: "启用帖内身份" }));
  expect(mocks.toggle).toHaveBeenCalledWith(true);
  expect(mocks.confirm).not.toHaveBeenCalled();
  view.rerender(<ThreadIdentitySettings threadId="t1" enabled />);
  mocks.confirm.mockResolvedValueOnce(false);
  await userEvent.click(screen.getByRole("button", { name: "关闭帖内身份" }));
  expect(mocks.toggle).toHaveBeenCalledTimes(1);
  mocks.toggle.mockRejectedValueOnce(new Error("离线"));
  await userEvent.click(screen.getByRole("button", { name: "关闭帖内身份" }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("离线"));
  expect(screen.getByRole("button", { name: "关闭帖内身份" })).toHaveAttribute("aria-pressed", "true");
  view.rerender(<ThreadIdentitySettings threadId="t1" enabled disabled />);
  expect(screen.getByRole("button", { name: "关闭帖内身份" })).toBeDisabled();
});

test("身份弹层切换查看账号时不沿用前一账号的未提交昵称", async () => {
  mocks.query.mockReturnValue({ data: { ...state, threadId: "t1", userId: "u1" } });
  const view = render(<ThreadIdentityControls threadId="t1" opened />);
  fireEvent.change(screen.getByLabelText("帖内昵称"), { target: { value: "未提交的私有角色" } });
  mocks.query.mockReturnValue({ data: { ...state, threadId: "t1", userId: "u2", identity: { ...state.identity, nickname: "另一个角色" }, account: { ...state.account, id: "u2" } } });
  view.rerender(<ThreadIdentityControls threadId="t1" opened />);
  expect(screen.getByLabelText("帖内昵称")).toHaveValue("另一个角色");
  expect(screen.queryByDisplayValue("未提交的私有角色")).not.toBeInTheDocument();
});
