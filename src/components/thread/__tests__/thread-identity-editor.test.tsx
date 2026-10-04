import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ThreadIdentityEditor } from "../thread-identity-editor";

const confirm = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/ui/confirm-provider", () => ({ useConfirm: () => confirm }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); confirm.mockResolvedValue(true); });
const props = () => ({
  accountUsername: "小明", nickname: "白鸦", avatar: null, hasCustomIdentity: true,
  onSave: vi.fn().mockResolvedValue(undefined), onClear: vi.fn().mockResolvedValue(undefined),
  onAvatar: vi.fn(), onClose: vi.fn(),
});

test("昵称留空单独保存为空，不改账号；头像入口独立", async () => {
  const user = userEvent.setup();
  const handlers = props();
  render(<ThreadIdentityEditor {...handlers} />);
  await user.click(screen.getByRole("button", { name: "设置帖内头像" }));
  expect(handlers.onAvatar).toHaveBeenCalledOnce();
  await user.clear(screen.getByLabelText("帖内昵称"));
  expect(screen.getByRole("img", { name: "小明头像" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "保存帖内身份" }));
  await waitFor(() => expect(handlers.onSave).toHaveBeenCalledWith(null));
  expect(handlers.onClear).not.toHaveBeenCalled();
  expect(handlers.onClose).toHaveBeenCalledOnce();
});

test("保存失败保留昵称，失去资格禁用操作后仍保留输入", async () => {
  const user = userEvent.setup();
  const handlers = props();
  handlers.onSave.mockRejectedValue(new Error("当前身份已变化"));
  const view = render(<ThreadIdentityEditor {...handlers} />);
  await user.clear(screen.getByLabelText("帖内昵称"));
  await user.type(screen.getByLabelText("帖内昵称"), "夜渡");
  await user.click(screen.getByRole("button", { name: "保存帖内身份" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("当前身份已变化");
  expect(screen.getByLabelText("帖内昵称")).toHaveValue("夜渡");
  expect(handlers.onClose).not.toHaveBeenCalled();
  view.rerender(<ThreadIdentityEditor {...handlers} disabled />);
  expect(screen.getByLabelText("帖内昵称")).toHaveValue("夜渡");
  expect(screen.getByRole("button", { name: "保存帖内身份" })).toBeDisabled();
});

test("清除需要确认且失败保留面板可重试", async () => {
  const user = userEvent.setup();
  const handlers = props();
  handlers.onClear.mockRejectedValueOnce(new Error("offline"));
  render(<ThreadIdentityEditor {...handlers} />);
  confirm.mockResolvedValueOnce(false);
  await user.click(screen.getByRole("button", { name: "清除帖内资料" }));
  expect(handlers.onClear).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "清除帖内资料" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("offline");
  expect(handlers.onClose).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "清除帖内资料" }));
  await waitFor(() => expect(handlers.onClose).toHaveBeenCalledOnce());
});

test("没有自定义资料时不提供清除按钮", () => {
  render(<ThreadIdentityEditor {...props()} hasCustomIdentity={false} nickname={null} />);
  expect(screen.queryByRole("button", { name: "清除帖内资料" })).not.toBeInTheDocument();
});

test("24个Unicode码点合法，超过上限与协议字符拒绝", async () => {
  const user = userEvent.setup();
  const handlers = props(); render(<ThreadIdentityEditor {...handlers} />);
  const input = screen.getByLabelText("帖内昵称");
  await user.clear(input); await user.type(input, "🌙".repeat(25));
  await user.click(screen.getByRole("button", { name: "保存帖内身份" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("最多24");
  expect(handlers.onSave).not.toHaveBeenCalled();
  await user.clear(input); await user.type(input, "🌙".repeat(24));
  await user.click(screen.getByRole("button", { name: "保存帖内身份" }));
  await waitFor(() => expect(handlers.onSave).toHaveBeenCalledWith("🌙".repeat(24)));
});
