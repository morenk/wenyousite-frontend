import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { UserFollowList } from "../user-follow-list";
import { setAuthSession, clearAuthSession } from "@/lib/auth-store";

const { GET, POST, DELETE, push } = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn(), push: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: { GET, POST, DELETE } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const user = { id: "u1", username: "本人", email: "me@example.test", role: "USER", avatar: null };
const peer = { id: "u2", username: "很长的用户名字用来验证完整识别", level: 2, avatar: null };
let following: boolean;
let follower: boolean;
let known: boolean;
let blocked: boolean;
let messages: boolean;
function renderList(kind: "following" | "followers" = "followers", userId = "u1", client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return { client, ...render(<QueryClientProvider client={client}><UserFollowList userId={userId} kind={kind} /></QueryClientProvider>) };
}
async function choose(person: ReturnType<typeof userEvent.setup>, name: string, trigger = "更多操作：" + peer.username) {
  await person.click(await screen.findByRole("button", { name: trigger }));
  await person.click(await screen.findByRole("menuitem", { name }));
}
beforeEach(() => {
  vi.resetAllMocks();
  setAuthSession(user, "test-only-token");
  following = true; follower = true; known = true; blocked = false; messages = true;
  GET.mockImplementation(async (path: string) => {
    if (path.endsWith("/meta")) return { data: { data: { capabilities: { directMessages: messages } } } };
    if (path === "/api/v1/users/{id}") return { data: { data: { isBlocked: blocked } } };
    return { data: { data: !blocked && (path.endsWith("/following") ? following : follower) ? [{
      [path.endsWith("/following") ? "following" : "follower"]: peer,
      ...(known ? { viewerIsFollowing: following, viewerIsFollowedBy: follower } : {}),
    }] : [] } };
  });
  POST.mockImplementation(async (path: string) => { if (path.includes("/block/")) blocked = true; else following = true; return { data: {} }; });
  DELETE.mockImplementation(async (path: string) => { if (path.includes("/me/followers/")) follower = false; else following = false; return { data: {} }; });
});
afterEach(() => { cleanup(); clearAuthSession(); });

test("紧凑状态按钮使用secondary，回关使用primary，关系只显示一次", async () => {
  const person = userEvent.setup();
  renderList();
  const status = await screen.findByRole("button", { name: "互相关注：" + peer.username });
  expect(status).toHaveAttribute("data-control-role", "secondary");
  expect(status).toHaveClass("h-12");
  expect(screen.getAllByText("互相关注")).toHaveLength(1);
  expect(status.closest("a")).toBeNull();
  await choose(person, "取消关注");
  const follow = await screen.findByRole("button", { name: "回关：" + peer.username });
  expect(follow).toHaveAttribute("data-control-role", "primary");
  await waitFor(() => expect(follow).toHaveFocus());
  await person.click(follow);
  await screen.findByRole("button", { name: "互相关注：" + peer.username });
  expect(screen.getAllByRole("link")).toHaveLength(1);
});
test("状态与更多打开同一菜单，键盘首尾导航、Escape回到各自触发器", async () => {
  const person = userEvent.setup();
  renderList();
  const status = await screen.findByRole("button", { name: "互相关注：" + peer.username });
  await person.click(status);
  expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(["私聊", "取消关注", "移除粉丝", "拉黑", "举报"]);
  await person.keyboard("{End}");
  expect(screen.getByRole("menuitem", { name: "举报" })).toHaveFocus();
  await person.keyboard("{Home}");
  expect(screen.getByRole("menuitem", { name: "私聊" })).toHaveFocus();
  await person.keyboard("{Escape}");
  await waitFor(() => expect(status).toHaveFocus());
  const more = screen.getByRole("button", { name: "更多操作：" + peer.username });
  await person.click(more);
  await screen.findByRole("menu");
  await person.keyboard("{Escape}");
  await waitFor(() => expect(more).toHaveFocus());
});
test("他人列表只浏览，匿名与缺字段不猜测关系", async () => {
  const view = renderList("followers", "other");
  await screen.findByRole("link", { name: new RegExp(peer.username) });
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  view.unmount();
  known = false;
  renderList();
  expect(await screen.findByRole("button", { name: "状态未知" })).toBeDisabled();
  expect(screen.getByRole("button", { name: /更多操作/ })).toBeDisabled();
  act(() => clearAuthSession());
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
test("关注列表取消后最后一项移行并恢复焦点", async () => {
  renderList("following");
  await choose(userEvent.setup(), "取消关注");
  await screen.findByText("还没有关注任何人");
  await waitFor(() => expect(screen.getByRole("heading", { name: "关注列表" })).toHaveFocus());
});
test("互关的关注页也能移除粉丝，只改变对方关注方向", async () => {
  const person = userEvent.setup();
  renderList("following");
  await choose(person, "移除粉丝");
  const dialog = await screen.findByRole("dialog");
  await person.click(within(dialog).getByRole("button", { name: "移除粉丝" }));
  await screen.findByRole("button", { name: "已关注：" + peer.username });
  expect(following).toBe(true);
  expect(follower).toBe(false);
});
test("移除确认在菜单关闭后打开，取消无写入并还原焦点", async () => {
  const person = userEvent.setup();
  renderList();
  await choose(person, "移除粉丝");
  const dialog = await screen.findByRole("dialog");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(within(dialog).getByRole("heading")).toHaveTextContent("移除粉丝「" + peer.username + "」？");
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "取消" })).toHaveFocus());
  await person.keyboard("{Escape}");
  await waitFor(() => expect(screen.getByRole("button", { name: "更多操作：" + peer.username })).toHaveFocus());
  expect(DELETE).not.toHaveBeenCalled();
});
test("提交时禁止关闭和重复点击，成功只移除粉丝", async () => {
  let release!: () => void;
  DELETE.mockImplementation(() => new Promise((resolve) => { release = () => { follower = false; resolve({ data: {} }); }; }));
  const person = userEvent.setup();
  renderList();
  await choose(person, "移除粉丝");
  await person.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "移除粉丝" }));
  expect(screen.getByRole("button", { name: "移除中" })).toBeDisabled();
  await person.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  act(() => release());
  await screen.findByText("还没有粉丝");
  expect(following).toBe(true);
  expect(DELETE).toHaveBeenCalledOnce();
});
test("拉黑先确认，取消无写入；成功按服务端可见性刷新而不取消关注", async () => {
  const person = userEvent.setup();
  renderList();
  await choose(person, "拉黑");
  await person.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "取消" }));
  expect(POST).not.toHaveBeenCalled();
  await choose(person, "拉黑");
  await person.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "拉黑" }));
  await screen.findByText("还没有粉丝");
  expect(following && follower).toBe(true);
  expect(POST).toHaveBeenCalledWith("/api/v1/users/me/block/{id}", expect.objectContaining({ params: { path: { id: peer.id } } }));
  expect(DELETE).not.toHaveBeenCalled();
});
test("明确失败保留原行与确认框，错误可读", async () => {
  DELETE.mockResolvedValue({ error: { message: "操作被拒绝" }, response: { status: 403 } });
  const person = userEvent.setup();
  renderList();
  await choose(person, "移除粉丝");
  await person.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "移除粉丝" }));
  expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("操作被拒绝");
  expect(document.querySelector("li a")).toHaveTextContent(peer.username);
});
test("结果未知只提供核实，切账号关闭旧确认框", async () => {
  const person = userEvent.setup();
  renderList();
  await choose(person, "拉黑");
  POST.mockRejectedValue(new TypeError("network"));
  GET.mockRejectedValue(new TypeError("offline"));
  await person.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "拉黑" }));
  await within(screen.getByRole("dialog")).findByRole("button", { name: "刷新核实" });
  expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "拉黑" })).not.toBeInTheDocument();
  act(() => setAuthSession({ ...user, id: "new-user" }, "other-session"));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(POST).toHaveBeenCalledOnce();
});
test("私聊与用户举报关闭菜单后进入既有入口", async () => {
  const person = userEvent.setup();
  renderList();
  await choose(person, "私聊");
  await waitFor(() => expect(push).toHaveBeenCalledWith("/messages/new/u2"));
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  await choose(person, "举报");
  await waitFor(() => expect(push).toHaveBeenCalledWith("/report?targetType=USER&targetId=u2"));
});
test("私聊能力关闭时菜单不显示私聊", async () => {
  messages = false;
  renderList();
  await userEvent.setup().click(await screen.findByRole("button", { name: /更多操作/ }));
  await screen.findByRole("menu");
  expect(screen.queryByRole("menuitem", { name: "私聊" })).not.toBeInTheDocument();
});
test("同目标未知锁切到他人列表时不暴露管理或核实入口", async () => {
  const person = userEvent.setup();
  const view = renderList();
  await person.click(await screen.findByRole("button", { name: /更多操作/ }));
  DELETE.mockRejectedValue(new TypeError("network"));
  const read = GET.getMockImplementation()!;
  GET.mockRejectedValue(new TypeError("offline"));
  await person.click(await screen.findByRole("menuitem", { name: "取消关注" }));
  await screen.findByRole("button", { name: /刷新核实：/ });
  GET.mockImplementation(read);
  view.rerender(<QueryClientProvider client={view.client}><UserFollowList userId="other" kind="followers" /></QueryClientProvider>);
  await screen.findByRole("link", { name: new RegExp(peer.username) });
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});


test("目标关系失效关闭确认，关系恢复也不会复活旧确认", async () => {
  const view = renderList("following");
  await choose(userEvent.setup(), "移除粉丝");
  await screen.findByRole("dialog");
  follower = false;
  await act(() => view.client.invalidateQueries());
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  follower = true;
  await act(() => view.client.invalidateQueries());
  await screen.findByRole("button", { name: "互相关注：" + peer.username });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(DELETE).not.toHaveBeenCalled();
});
