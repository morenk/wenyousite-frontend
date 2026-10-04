
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ThreadPostAuthor } from "../thread-post-author";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(), permissions: vi.fn(), auth: vi.fn(), open: vi.fn(), close: vi.fn(),
  filter: vi.fn(), refetch: vi.fn(), clearThread: vi.fn(),
}));
vi.mock("@/api/hooks/use-thread-identity", () => ({ useThreadUserIdentity: (...args: unknown[]) => mocks.identity(...args) }));
vi.mock("@/api/hooks/use-content-access-cache", () => ({ useContentAccessCache: () => ({ clearThread: mocks.clearThread }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => mocks.auth() }));
vi.mock("@/components/thread/thread-permissions-context", () => ({ useThreadPermissions: () => mocks.permissions() }));
vi.mock("@/components/thread/thread-composer-context", () => ({ useThreadComposerSession: () => ({ open: mocks.open, close: mocks.close }) }));
const author = { id: "u1", username: "小明", avatar: null, rpIdentity: { id: "rp1", nickname: "白鸦", avatar: null } };
const props = { author, threadId: "t1", subthreadId: "s1", postId: "p1" };
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockReturnValue({ user: { id: "viewer" } }); mocks.close.mockResolvedValue(true);
  mocks.permissions.mockReturnValue({ rpIdentityEnabled: true, setAuthorFilter: mocks.filter });
  mocks.identity.mockReturnValue({ data: { display: { nickname: "夜渡" }, account: { username: "小明" } }, refetch: mocks.refetch });
});
afterEach(cleanup);
test("旧楼层先打开身份卡，区分当时身份与当前昵称，账号链接稳定", async () => {
  render(<ThreadPostAuthor {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  expect(screen.getByText("当前帖内昵称：夜渡")).toBeInTheDocument();
  expect(screen.getByText("本条发言身份")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "查看站内主页" })).toHaveAttribute("href", "/users/u1");
  expect(mocks.identity).toHaveBeenLastCalledWith("t1", "u1", true);
});
test("提及用当前身份而非历史昵称，原账号不变", async () => {
  render(<ThreadPostAuthor {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  await userEvent.click(screen.getByRole("button", { name: "提及" }));
  expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ type: "reply", parentPostId: "p1", replyToPostId: "p1", initialContent: "[@夜渡](/users/u1) " }));
});
test("清除当前角色后提及使用账号；BODY提及进入新楼层", async () => {
  mocks.identity.mockReturnValue({ data: { display: null, account: { username: "小明" } } });
  render(<ThreadPostAuthor {...props} body />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  await userEvent.click(screen.getByRole("button", { name: "提及" }));
  expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ type: "create-floor", anchorId: "create-floor:s1", initialContent: "[@小明](/users/u1) " }));
});
test("只看此人按账号且遵守当前楼中楼范围，未确认草稿不能筛选", async () => {
  render(<ThreadPostAuthor {...props} parentPostId="root" filterReplies />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  mocks.close.mockResolvedValueOnce(false);
  await userEvent.click(screen.getByRole("button", { name: "只看此人" }));
  expect(mocks.filter).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  await userEvent.click(screen.getByRole("button", { name: "只看此人" }));
  await waitFor(() => expect(mocks.filter).toHaveBeenCalledWith({ subthreadId: "s1", parentPostId: "root", authorId: "u1" }));
});
test("匿名或当前身份失败不提供提及，可重试；关闭时回到账号", async () => {
  mocks.auth.mockReturnValue({ user: null });
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
  expect(screen.queryByText("当前帖内昵称：夜渡")).not.toBeInTheDocument();
  expect(screen.getByRole("dialog")).toHaveTextContent("小明");
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
