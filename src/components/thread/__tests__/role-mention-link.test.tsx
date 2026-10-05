import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MarkdownContent } from "../markdown-content";

const mocks = vi.hoisted(() => ({ state: {} as Record<string, unknown>, read: vi.fn(), clear: vi.fn(), retry: vi.fn() }));
vi.mock("@/api/hooks/use-rp-identities", () => ({ useRpIdentity: (...args: unknown[]) => { mocks.read(...args); return { ...mocks.state, refetch: mocks.retry }; } }));
vi.mock("@/api/hooks/use-content-access-cache", () => ({ useContentAccessCache: () => ({ clearThread: mocks.clear }) }));
const roleId = "c00000000000000000000000b";
const href = "/users/u1?rpIdentityId=" + roleId;
const projection = { userId: "u1", label: "旧同名", displayName: "旧同名", identityId: roleId, targetIdentityId: roleId, sourceHref: href, threadId: "thread-b" };
const state = { enabled: true, deleted: false, account: { id: "u1", username: "账号", avatar: null }, display: { nickname: "角色B新名", avatar: null } };
beforeEach(() => { vi.clearAllMocks(); mocks.state = { data: state }; });
afterEach(cleanup);

test("角色@用源角色ID打开卡片，HTML属性保留原label，账号入口仍真实账号", async () => {
  render(<MarkdownContent content={"[@旧同名](" + href + ")"} mentionIdentities={[projection]} />);
  const link = screen.getByRole("link", { name: "@旧同名" });
  expect(link).toHaveAttribute("data-wenyou-mention-source-href", href);
  expect(link).toHaveAttribute("data-wenyou-mention-source-label", "@旧同名");
  await userEvent.click(link);
  expect(mocks.read).toHaveBeenLastCalledWith("thread-b", roleId, true);
  const card = within(screen.getByRole("dialog"));
  expect(card.getByText("旧同名")).toBeInTheDocument();
  expect(card.queryByText("角色B新名")).not.toBeInTheDocument();
  expect(card.getByRole("link", { name: "查看账号的用户主页" })).toHaveAttribute("href", "/users/u1");
});
test("显式账号@直接主页且不读取该账号任何RP", () => {
  render(<MarkdownContent content="[@旧账号](/users/u1?identityMode=ACCOUNT)" mentionIdentities={[
    { userId: "u1", label: "旧账号", displayName: "账号", identityId: null, sourceHref: "/users/u1?identityMode=ACCOUNT", targetIdentityId: null },
  ]} />);
  expect(screen.getByRole("link", { name: "@账号" })).toHaveAttribute("href", "/users/u1");
  expect(mocks.read).not.toHaveBeenCalled();
});
test("新读取明确关闭时马上遮蔽旧角色名；403清缓存并移除旧卡", async () => {
  const view = render(<MarkdownContent content={"[@旧同名](" + href + ")"} mentionIdentities={[projection]} />);
  await userEvent.click(screen.getByRole("link", { name: "@旧同名" }));
  mocks.state = { data: { ...state, enabled: false, display: null } };
  view.rerender(<MarkdownContent content={"[@旧同名](" + href + ")"} mentionIdentities={[projection]} />);
  expect(screen.queryByText("旧同名")).not.toBeInTheDocument();
  expect(screen.queryByText("角色B新名")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "@账号", hidden: true })).toBeInTheDocument();
  mocks.state = { isError: true, error: { status: 403, code: 40301 } };
  view.rerender(<MarkdownContent content={"[@旧同名](" + href + ")"} mentionIdentities={[projection]} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mocks.clear).toHaveBeenCalledWith("thread-b");
  expect(screen.getByText("不可用用户")).toBeInTheDocument();
});
test("没有投影上下文不能猜当前主题或另一个角色", () => {
  render(<MarkdownContent content={"[@旧同名](" + href + ")"} />);
  expect(mocks.read).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "@旧同名" })).toHaveAttribute("href", "/users/u1");
});

test.each(["*白鸦*", "反`号`", "&amp;"])("阅读角色昵称%s保持原字符并按原label安全投影", (nickname) => {
  const identity = { ...projection, label: nickname, displayName: nickname };
  const view = render(<MarkdownContent content={"***[@" + nickname + "](" + href + ")***"} mentionIdentities={[identity]} />);
  const link = screen.getByRole("link", { name: "@" + nickname });
  expect(link).toHaveAttribute("data-wenyou-mention-source-label", "@" + nickname);
  expect(link.closest("strong")).not.toBeNull();
  view.rerender(<MarkdownContent content={"[@" + nickname + "](" + href + ")"} mentionIdentities={[{ ...identity, displayName: "账号", identityId: null }]} />);
  expect(screen.getByRole("link", { name: "@账号" })).toHaveAttribute("data-wenyou-mention-source-label", "@" + nickname);
});
