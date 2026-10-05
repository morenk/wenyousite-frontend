
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ThreadPostAuthor } from "../thread-post-author";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(), permissions: vi.fn(), refetch: vi.fn(), clearThread: vi.fn(),
}));
vi.mock("@/api/hooks/use-rp-identities", () => ({ useRpIdentity: (...args: unknown[]) => mocks.identity(...args) }));
vi.mock("@/api/hooks/use-content-access-cache", () => ({ useContentAccessCache: () => ({ clearThread: mocks.clearThread }) }));
vi.mock("@/components/thread/thread-permissions-context", () => ({ useThreadPermissions: () => mocks.permissions() }));
const author = { id: "u1", username: "小明", avatar: null, rpIdentity: { id: "rp1", nickname: "白鸦", avatar: null } };
const props = { author, threadId: "t1" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permissions.mockReturnValue({ rpIdentityEnabled: true, ownerId: "u1" });
  mocks.identity.mockReturnValue({ data: { display: { nickname: "夜渡" }, account: { username: "小明" } }, refetch: mocks.refetch });
});
afterEach(cleanup);
test("旧楼层身份卡只展示当时头像昵称，账号链接稳定", async () => {
  render(<ThreadPostAuthor {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  expect(screen.queryByText("现为")).not.toBeInTheDocument();
  expect(screen.queryByText("夜渡")).not.toBeInTheDocument();
  expect(screen.getByText("楼主")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "查看小明的用户主页" })).toHaveAttribute("href", "/users/u1");
  expect(mocks.identity).toHaveBeenLastCalledWith("t1", "rp1", true);
});
test("清除当前RP不显示回退卡；稳定账号行替代卡内操作", async () => {
  mocks.identity.mockReturnValue({ data: { display: null, account: { id: "u1", username: "小明", avatar: "/account.webp" } } });
  render(<ThreadPostAuthor {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.queryByText("现为")).not.toBeInTheDocument();
  expect(dialog.queryByText("当前使用站内资料")).not.toBeInTheDocument();
  expect(dialog.queryByRole("button", { name: "提及" })).not.toBeInTheDocument();
  expect(dialog.queryByRole("button", { name: "只看此人" })).not.toBeInTheDocument();
  expect(dialog.getByRole("link", { name: "查看小明的用户主页" })).toHaveAttribute("href", "/users/u1");
  expect(dialog.getByRole("img", { name: "小明" })).toHaveAttribute("src", "/account.webp");
});
test("当前身份失败可重试；关闭时回到账号", async () => {
  mocks.identity.mockReturnValue({ isError: true, refetch: mocks.refetch });
  const view = render(<ThreadPostAuthor {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  expect(screen.queryByRole("button", { name: "提及" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "重试" }));
  expect(mocks.refetch).toHaveBeenCalledOnce();
  mocks.permissions.mockReturnValue({ rpIdentityEnabled: false });
  view.rerender(<ThreadPostAuthor {...props} />);
  expect(screen.getByRole("link", { name: "小明" })).toHaveAttribute("href", "/users/u1");
  expect(screen.queryByRole("button", { name: "白鸦" })).not.toBeInTheDocument();
});

test("身份查询已知关闭时立即隐藏历史RP昵称和头像", async () => {
  const view = render(<ThreadPostAuthor {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  mocks.identity.mockReturnValue({ data: { enabled: false, display: null, account: { username: "小明" } } });
  view.rerender(<ThreadPostAuthor {...props} />);
  expect(screen.queryByText("白鸦")).not.toBeInTheDocument();
  expect(screen.queryByText("夜渡")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "查看小明的用户主页" })).toHaveAttribute("href", "/users/u1");
});
test.each([403, 404])("身份卡读取%s立即关闭并清除主题缓存，不再暴露旧身份", async (status) => {
  const view = render(<ThreadPostAuthor {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  mocks.identity.mockReturnValue({ isError: true, error: { status, code: status === 403 ? 40300 : 40400 } });
  view.rerender(<ThreadPostAuthor {...props} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("白鸦")).not.toBeInTheDocument();
  await waitFor(() => expect(mocks.clearThread).toHaveBeenCalledWith("t1"));
  mocks.identity.mockReturnValue({ isPending: true });
  view.rerender(<ThreadPostAuthor {...props} />);
  expect(screen.queryByText("白鸦")).not.toBeInTheDocument();
});

test.each([false, true])("身份开关%s时沿用楼层头像字号，并支持楼中楼紧凑字号", (enabled) => {
  mocks.permissions.mockReturnValue({ rpIdentityEnabled: enabled });
  const name = enabled ? "白鸦头像" : "小明头像";
  const view = render(<ThreadPostAuthor {...props} />);
  expect(screen.getByRole("img", { name })).toHaveClass("text-sm");
  view.rerender(<ThreadPostAuthor {...props} avatarTextClassName="text-[9px]" />);
  expect(screen.getByRole("img", { name })).toHaveClass("text-[9px]");
  expect(screen.getByRole("img", { name })).not.toHaveClass("text-sm");
});

test.each([true, false, undefined])("本条没有RP快照时直接进入站内主页，开关%s不改变入口", async (enabled) => {
  mocks.permissions.mockReturnValue({ rpIdentityEnabled: enabled });
  render(<ThreadPostAuthor {...props} author={{ ...author, rpIdentity: undefined }} />);
  const avatar = screen.getByRole("link", { name: "查看小明的用户主页" });
  expect(avatar).toHaveAttribute("href", "/users/u1");
  expect(screen.getByRole("link", { name: "小明" })).toHaveAttribute("href", "/users/u1");
  expect(screen.queryByRole("button", { name: /帖内身份/ })).not.toBeInTheDocument();
  expect(mocks.identity).not.toHaveBeenCalled();
  avatar.addEventListener("click", (event) => event.preventDefault(), { once: true });
  await userEvent.click(avatar);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("RP开关旧响应缺失时仍按该条RP快照打开卡片", async () => {
  mocks.permissions.mockReturnValue({});
  render(<ThreadPostAuthor {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  expect(screen.getByRole("dialog", { name: "帖内身份" })).toBeInTheDocument();
});

test("身份读取确认关闭后，主页入口使用最新账号头像及原作者ID", async () => {
  mocks.identity.mockReturnValue({ data: { enabled: false, account: { username: "新账号名", avatar: "/latest-avatar.webp" } } });
  render(<ThreadPostAuthor {...props} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "查看新账号名的用户主页" })).toHaveAttribute("href", "/users/u1");
  expect(screen.getByRole("img", { name: "新账号名" })).toHaveAttribute("src", "/latest-avatar.webp");
});
