import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { UserFollowList } from "../user-follow-list";
import { setAuthSession, clearAuthSession } from "@/lib/auth-store";

const { GET, POST, DELETE } = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: { GET, POST, DELETE } }));
const user = { id: "u1", username: "本人", email: "me@example.test", role: "USER", avatar: null };
const peer = { id: "u2", username: "很长的用户名字用来验证完整识别", level: 2, avatar: null };
let following: boolean;
let follower: boolean;
let known: boolean;
function renderList(kind: "following" | "followers" = "followers", userId = "u1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><UserFollowList userId={userId} kind={kind} /></QueryClientProvider>);
}
beforeEach(() => {
  vi.resetAllMocks();
  setAuthSession(user, "test-only-token");
  following = true; follower = true; known = true;
  GET.mockImplementation(async (path: string) => ({
    data: { data: (path.endsWith("/following") ? following : follower) ? [{
      [path.endsWith("/following") ? "following" : "follower"]: peer,
      ...(known ? { viewerIsFollowing: following, viewerIsFollowedBy: follower } : {}),
    }] : [] },
  }));
  POST.mockImplementation(async () => { following = true; return { data: {} }; });
  DELETE.mockImplementation(async (path: string) => {
    if (path.includes("/me/followers/")) follower = false; else following = false;
    return { data: {} };
  });
});
afterEach(() => { cleanup(); clearAuthSession(); });
test("本人列表各动作统一描边，与资料链接分离", async () => {
  renderList();
  const cancel = await screen.findByRole("button", { name: /取消关注：/ });
  const remove = screen.getByRole("button", { name: /移除粉丝：/ });
  expect(cancel).toHaveClass("border-border", "h-10");
  expect(remove).toHaveClass("border-border", "h-10");
  expect(cancel.closest("a")).toBeNull();
  expect(remove.closest("a")).toBeNull();
  expect(screen.getByText("互相关注")).toBeInTheDocument();
});
test("他人列表只浏览，不暴露本人管理", async () => {
  renderList("followers", "other");
  await screen.findByRole("link", { name: new RegExp(peer.username) });
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
test("匿名和缺少关系字段不猜测回关状态", async () => {
  known = false;
  renderList();
  await screen.findByText("关系状态暂不可用");
  expect(screen.queryByRole("button", { name: /回关/ })).not.toBeInTheDocument();
  act(() => clearAuthSession());
  expect(screen.queryByText("关系状态暂不可用")).not.toBeInTheDocument();
});
test("粉丝列表取消关注保留原行，回关恢复互关", async () => {
  const person = userEvent.setup();
  renderList();
  await person.click(await screen.findByRole("button", { name: /取消关注：/ }));
  await person.click(await screen.findByRole("button", { name: /回关：/ }));
  await screen.findByText("互相关注");
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(POST).toHaveBeenCalledOnce();
  expect(DELETE).toHaveBeenCalledOnce();
});
test("关注列表取消后最后一项变为空态并恢复焦点", async () => {
  const person = userEvent.setup();
  renderList("following");
  await person.click(await screen.findByRole("button", { name: /取消关注：/ }));
  await screen.findByText("还没有关注任何人");
  await waitFor(() => expect(screen.getByRole("heading", { name: "关注列表" })).toHaveFocus());
});
test("移除确认默认聚焦取消，取消无写入并还原焦点", async () => {
  const person = userEvent.setup();
  renderList();
  const trigger = await screen.findByRole("button", { name: /移除粉丝：/ });
  await person.click(trigger);
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("heading")).toHaveTextContent("移除粉丝「" + peer.username + "」？");
  expect(within(dialog).getByText("移除后，对方将不再关注你。不会通知对方，对方仍可重新关注你。")).toBeInTheDocument();
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "取消" })).toHaveFocus());
  await person.keyboard("{Escape}");
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(DELETE).not.toHaveBeenCalled();
});
test("确认期间禁止关闭与重复点击，成功只移除粉丝", async () => {
  let release!: () => void;
  DELETE.mockImplementation(() => new Promise((resolve) => { release = () => { follower = false; resolve({ data: {} }); }; }));
  const person = userEvent.setup();
  renderList();
  await person.click(await screen.findByRole("button", { name: /移除粉丝：/ }));
  await person.click(within(screen.getByRole("dialog")).getByRole("button", { name: "移除粉丝" }));
  expect(screen.getByRole("button", { name: "移除中" })).toBeDisabled();
  await person.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  act(() => release());
  await screen.findByText("还没有粉丝");
  expect(following).toBe(true);
  expect(DELETE).toHaveBeenCalledOnce();
});
test("失败保留原行与确认框，错误可读", async () => {
  DELETE.mockResolvedValue({ error: { message: "操作被拒绝" }, response: { status: 403 } });
  const person = userEvent.setup();
  renderList();
  await person.click(await screen.findByRole("button", { name: /移除粉丝：/ }));
  await person.click(within(screen.getByRole("dialog")).getByRole("button", { name: "移除粉丝" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("操作被拒绝");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(document.querySelector("li a")).toHaveTextContent(peer.username);
});
test("网络结果未知时仅提供刷新核实，核实后才能继续", async () => {
  const person = userEvent.setup();
  renderList();
  await person.click(await screen.findByRole("button", { name: /移除粉丝：/ }));
  DELETE.mockRejectedValue(new TypeError("network"));
  GET.mockRejectedValue(new TypeError("offline"));
  await person.click(within(screen.getByRole("dialog")).getByRole("button", { name: "移除粉丝" }));
  await screen.findByRole("button", { name: "刷新核实" });
  expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "移除粉丝" })).not.toBeInTheDocument();
  expect(DELETE).toHaveBeenCalledOnce();
});


test("同一目标未核实时，他人列表不显示管理、错误或核实入口", async () => {
  const person = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><UserFollowList userId="u1" kind="followers" /></QueryClientProvider>);
  const trigger = await screen.findByRole("button", { name: /取消关注：/ });
  DELETE.mockRejectedValue(new TypeError("network"));
  const read = GET.getMockImplementation()!;
  GET.mockRejectedValue(new TypeError("offline"));
  await person.click(trigger);
  await screen.findByRole("button", { name: "刷新核实" });
  GET.mockImplementation(read);
  view.rerender(<QueryClientProvider client={client}><UserFollowList userId="other" kind="followers" /></QueryClientProvider>);
  await screen.findByRole("link", { name: new RegExp(peer.username) });
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(DELETE).toHaveBeenCalledOnce();
});
