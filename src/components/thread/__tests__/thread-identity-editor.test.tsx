import { RpProfilePostLinkError } from "@/api/hooks/use-rp-profile-post";
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
  accountUsername: "小明", nickname: "白鸦", avatar: null, existingIdentity: true,
  onSave: vi.fn().mockResolvedValue(undefined), onDelete: vi.fn().mockResolvedValue(undefined),
  onAvatar: vi.fn(), onClose: vi.fn(),
});

test("昵称留空单独保存为空，不改账号；头像入口独立", async () => {
  const user = userEvent.setup();
  const handlers = props();
  render(<ThreadIdentityEditor {...handlers} />);
  await user.click(screen.getByRole("button", { name: "修改帖内头像" }));
  expect(handlers.onAvatar).toHaveBeenCalledOnce();
  expect(screen.queryByText("修改帖内头像")).not.toBeInTheDocument();
  expect(screen.queryByText("帖内身份", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText(/@小明|站内账号：小明/)).not.toBeInTheDocument();
  const avatarButton = screen.getByRole("button", { name: "修改帖内头像" });
  expect(avatarButton).toContainElement(screen.getByRole("img", { name: "白鸦头像" }));
  avatarButton.focus();
  await user.keyboard("{Enter}");
  expect(handlers.onAvatar).toHaveBeenCalledTimes(2);
  await user.clear(screen.getByLabelText("帖内昵称"));
  expect(screen.getByRole("img", { name: "小明头像" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "保存昵称" }));
  await waitFor(() => expect(handlers.onSave).toHaveBeenCalledWith(null));
  expect(handlers.onDelete).not.toHaveBeenCalled();
  expect(handlers.onClose).toHaveBeenCalledOnce();
});

test("保存失败保留昵称，失去资格禁用操作后仍保留输入", async () => {
  const user = userEvent.setup();
  const handlers = props();
  handlers.onSave.mockRejectedValue(new Error("当前身份已变化"));
  const view = render(<ThreadIdentityEditor {...handlers} />);
  await user.clear(screen.getByLabelText("帖内昵称"));
  await user.type(screen.getByLabelText("帖内昵称"), "夜渡");
  await user.click(screen.getByRole("button", { name: "保存昵称" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("当前身份已变化");
  expect(screen.getByLabelText("帖内昵称")).toHaveValue("夜渡");
  expect(handlers.onClose).not.toHaveBeenCalled();
  view.rerender(<ThreadIdentityEditor {...handlers} disabled />);
  expect(screen.getByLabelText("帖内昵称")).toHaveValue("夜渡");
  expect(screen.getByRole("button", { name: "保存昵称" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "修改帖内头像" })).toBeDisabled();
});

test("清除需要确认且失败保留面板可重试", async () => {
  const user = userEvent.setup();
  const handlers = props();
  handlers.onDelete.mockRejectedValueOnce(new Error("offline"));
  render(<ThreadIdentityEditor {...handlers} />);
  confirm.mockResolvedValueOnce(false);
  await user.click(screen.getByRole("button", { name: "删除帖内身份" }));
  expect(handlers.onDelete).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "删除帖内身份" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("offline");
  expect(handlers.onClose).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "删除帖内身份" }));
  await waitFor(() => expect(handlers.onClose).toHaveBeenCalledOnce());
});

test("新角色不提供删除按钮", () => {
  render(<ThreadIdentityEditor {...props()} existingIdentity={false} nickname={null} />);
  expect(screen.queryByRole("button", { name: "删除帖内身份" })).not.toBeInTheDocument();
  expect(screen.queryByText(/用于本主题|头像在头像面板|留空沿用/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "创建身份" })).toBeInTheDocument();
});

test("24个Unicode码点合法，超过上限与协议字符拒绝", async () => {
  const user = userEvent.setup();
  const handlers = props(); render(<ThreadIdentityEditor {...handlers} />);
  const input = screen.getByLabelText("帖内昵称");
  await user.clear(input); await user.type(input, "🌙".repeat(25));
  await user.click(screen.getByRole("button", { name: "保存昵称" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("最多24");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription(/最多24/);
  expect(screen.getByText("25/24")).toBeInTheDocument();
  expect(handlers.onSave).not.toHaveBeenCalled();
  await user.clear(input); await user.type(input, "🌙".repeat(24));
  await user.click(screen.getByRole("button", { name: "保存昵称" }));
  await waitFor(() => expect(handlers.onSave).toHaveBeenCalledWith("🌙".repeat(24)));
});


test("资料能力缺失隐藏字段，字段校验失败保留输入并关联可访问错误", async () => {
  const handlers = props();
  const view = render(<ThreadIdentityEditor {...handlers} />);
  expect(screen.queryByLabelText("资料楼层链接")).not.toBeInTheDocument();
  view.unmount();
  handlers.onSave.mockRejectedValueOnce(new RpProfilePostLinkError("资料暂不可用"));
  render(<ThreadIdentityEditor {...handlers} profileSupported profileLink="/threads/t?post=p" />);
  const input = screen.getByLabelText("资料楼层链接");
  await userEvent.clear(input);
  await userEvent.type(input, "/threads/t?post=unavailable");
  await userEvent.click(screen.getByRole("button", { name: "保存资料" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("资料暂不可用");
  expect(input).toHaveValue("/threads/t?post=unavailable");
  expect(input).toHaveAccessibleDescription("资料暂不可用");
  expect(handlers.onClose).not.toHaveBeenCalled();
});
