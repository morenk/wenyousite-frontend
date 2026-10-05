
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ThreadPublicationIdentity } from "../thread-publication-identity";
import { collection, role } from "./rp-identity-fixtures";
import type { useThreadIdentitySubmission } from "../use-thread-identity-submission";
vi.mock("@/components/thread/thread-identity-controls", () => ({ ThreadIdentityControls: () => <div role="dialog" aria-label="资料编辑器" /> }));
afterEach(cleanup);
function controller(overrides: Record<string, unknown> = {}) {
  return { query: { data: collection(), refetch: vi.fn() },
    identityId: "rp1", chooseCreated: vi.fn(), mode: "RP", choose: vi.fn(), prepare: vi.fn(), requireConfirmation: vi.fn(), canUseRp: true, displayName: "白鸦", ...overrides } as unknown as ReturnType<typeof useThreadIdentitySubmission>;
}
test("本次选择和资料设置分开，未知提交禁切换", async () => {
  const value = controller();
  const view = render(<ThreadPublicationIdentity controller={value} threadId="t1" />);
  expect(screen.queryByText("本次发表")).not.toBeInTheDocument();
  expect(screen.getByText("白鸦")).toBeInTheDocument();
  expect(screen.queryByText("以「白鸦」发表")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "发表身份" }));
  await userEvent.click(screen.getByRole("menuitemradio", { name: "站内身份：小明" }));
  expect(value.choose).toHaveBeenCalledWith("ACCOUNT", undefined);
  view.rerender(<ThreadPublicationIdentity controller={value} threadId="t1" disabled />);
  expect(screen.getByRole("button", { name: "发表身份" })).toBeDisabled();
  expect(screen.queryByRole("dialog", { name: "资料编辑器" })).not.toBeInTheDocument();
});
test("加载失败提供重试，加载状态不显示误导性的账号选择", async () => {
  const view = render(<ThreadPublicationIdentity controller={controller({ query: { isPending: true } })} threadId="t1" />);
  expect(screen.getByRole("status")).toHaveTextContent("加载");
  const refetch = vi.fn();
  view.rerender(<ThreadPublicationIdentity controller={controller({ query: { isError: true, refetch } })} threadId="t1" />);
  await userEvent.click(screen.getByRole("button", { name: "身份加载失败，重试" }));
  expect(refetch).toHaveBeenCalledOnce();
});


test("没有有效RP且选择账号时不显示无意义选项", () => {
  const choose = vi.fn();
  render(<ThreadPublicationIdentity controller={controller({ canUseRp: false, mode: "ACCOUNT", choose,
    query: { data: collection([], { account: { id: "u1", username: "读者", avatar: null }, canEdit: false }) } })} threadId="t1" />);
  expect(screen.queryByRole("button", { name: "发表身份" })).not.toBeInTheDocument();
  expect(screen.getByText("读者")).toBeInTheDocument();
  expect(screen.queryByText("站内身份")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "资料编辑器" })).not.toBeInTheDocument();
  expect(choose).not.toHaveBeenCalled();
});

test("旧草稿RP失效时显示账号真实头像，不显示常驻说明或改写草稿选择", async () => {
  const value = controller({ canUseRp: false, query: { data: collection([], { canEdit: false }) } });
  render(<ThreadPublicationIdentity controller={value} threadId="t1" />);
  expect(screen.queryByText("白鸦")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "小明" })).toHaveAttribute("src", "/account-avatar.webp");
  expect(screen.queryByText("站内身份")).not.toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(value.choose).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "发表身份" }));
  expect(screen.queryByRole("menuitemradio", { name: /帖内身份/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("menuitemradio", { name: "站内身份：小明" }));
  expect(value.choose).toHaveBeenCalledWith("ACCOUNT", undefined);
});

test("同昵称两种模式仍有明确类型，资料变更不会改写草稿选择", async () => {
  const value = controller({ displayName: "小明", query: { data: collection([role("rp1", "小明")]) } });
  const view = render(<ThreadPublicationIdentity controller={value} threadId="t1" />);
  await userEvent.click(screen.getByRole("button", { name: "发表身份" }));
  expect(screen.getByRole("menuitemradio", { name: "帖内身份：小明" })).toBeInTheDocument();
  expect(screen.getByRole("menuitemradio", { name: "站内身份：小明" })).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  view.rerender(<ThreadPublicationIdentity controller={controller({ displayName: "旧名字" })} threadId="t1" />);
  expect(screen.getByText("白鸦")).toBeInTheDocument();
  expect(screen.queryByText("旧名字")).not.toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});


test("编辑在RP选项的行内，点笔不改变当前ACCOUNT选择", async () => {
  const value = controller({ mode: "ACCOUNT", displayName: "小明" });
  render(<ThreadPublicationIdentity controller={value} threadId="t1" />);
  expect(screen.queryByRole("menuitem", { name: "编辑白鸦的帖内资料" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "发表身份" }));
  const edit = screen.getByRole("menuitem", { name: "编辑白鸦的帖内资料" });
  const roleplay = screen.getByRole("menuitemradio", { name: "帖内身份：白鸦" });
  expect(edit.parentElement).toBe(roleplay.parentElement);
  expect(screen.queryByText("编辑帖内资料")).not.toBeInTheDocument();
  await userEvent.click(edit);
  expect(screen.getByRole("dialog", { name: "资料编辑器" })).toBeInTheDocument();
  expect(value.choose).not.toHaveBeenCalled();
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

test("有资格未配置时提供加号设置项；设置本身不改变ACCOUNT选择", async () => {
  const value = controller({ canUseRp: false, mode: "ACCOUNT", displayName: "小明",
    query: { data: collection([]) } });
  render(<ThreadPublicationIdentity controller={value} threadId="t1" />);
  await userEvent.click(screen.getByRole("button", { name: "发表身份" }));
  expect(screen.getByRole("menuitemradio", { name: "站内身份：小明" })).toHaveAttribute("aria-checked", "true");
  expect(screen.queryByRole("menuitemradio", { name: /帖内身份/ })).not.toBeInTheDocument();
  const setup = screen.getByRole("menuitem", { name: "设置帖内身份" });
  setup.focus();
  await userEvent.keyboard("{Enter}");
  expect(screen.getByRole("dialog", { name: "资料编辑器" })).toBeInTheDocument();
  expect(value.choose).not.toHaveBeenCalled();
});

test("空角色保留配置入口并计入名额，不能选为发表身份", async () => {
  const value = controller({ mode: "ACCOUNT", query: { data: collection([role("blank", "", {
    display: null, identityToken: null, identity: { id: "blank", nickname: null, avatarMediaId: null, version: 1 },
  })], { activeCount: 10 }) } });
  render(<ThreadPublicationIdentity controller={value} threadId="t1" />);
  await userEvent.click(screen.getByRole("button", { name: "发表身份" }));
  expect(screen.getByRole("menuitem", { name: "配置未设置" })).toBeInTheDocument();
  expect(screen.queryByRole("menuitemradio", { name: /未设置/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "新增帖内身份" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("menuitem", { name: "配置未设置" }));
  expect(screen.getByRole("dialog", { name: "资料编辑器" })).toBeInTheDocument();
  expect(value.choose).not.toHaveBeenCalled();
});
