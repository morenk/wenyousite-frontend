import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ThreadIdentityCard } from "../thread-identity-card";

afterEach(cleanup);
const base = { account: { id: "account-1", username: "小明", avatar: "/account-avatar.webp" }, appearance: { name: "白鸦", avatar: null } };

test("历史身份、当前变化和可点击账号行，移除重复说明及卡内动作", async () => {
  const opened = vi.fn();
  render(<ThreadIdentityCard {...base} currentAppearance={{ name: "夜渡", avatar: null }} onOpen={opened} />);
  await userEvent.click(screen.getByRole("button", { name: "查看白鸦的帖内身份" }));
  expect(opened).toHaveBeenCalledOnce();
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("白鸦")).toBeInTheDocument();
  expect(dialog.getByText("现为")).toBeInTheDocument();
  expect(dialog.getByText("夜渡")).toBeInTheDocument();
  const account = dialog.getByRole("link", { name: "查看小明的用户主页" });
  expect(account).toHaveAttribute("href", "/users/account-1");
  expect(within(account).getByRole("img", { name: "小明" })).toHaveAttribute("src", "/account-avatar.webp");
  for (const text of ["本条发言身份", "当前帖内身份", "站内账号：小明", "查看站内主页", "提及", "只看此人"]) {
    expect(dialog.queryByText(text)).not.toBeInTheDocument();
  }
});

test("身份无变化时只展示发言身份与一个账号入口", async () => {
  render(<ThreadIdentityCard {...base} currentAppearance={{ name: "白鸦", avatar: null }} />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.queryByText("现为")).not.toBeInTheDocument();
  expect(dialog.getAllByRole("link")).toHaveLength(1);
  expect(dialog.getAllByText("白鸦")).toHaveLength(1);
});

test("账号发言只保留一条可点击账号行，不套用当前RP", async () => {
  render(<ThreadIdentityCard {...base} appearance={{ name: "小明", avatar: "/account-avatar.webp" }}
    isRoleplay={false} currentAppearance={{ name: "夜渡", avatar: null }} badges={<span>楼主</span>} />);
  await userEvent.click(screen.getByRole("button", { name: "小明" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getAllByText("小明")).toHaveLength(1);
  expect(dialog.getAllByRole("img")).toHaveLength(1);
  expect(dialog.getByText("楼主")).toBeInTheDocument();
  expect(dialog.queryByText("夜渡")).not.toBeInTheDocument();
  expect(dialog.queryByText("现为")).not.toBeInTheDocument();
  expect(dialog.getByRole("link", { name: "查看小明的用户主页" })).toHaveAttribute("href", "/users/account-1");
});

test("只改头像也展示现为行，保留当前头像", async () => {
  render(<ThreadIdentityCard {...base} currentAppearance={{ name: "白鸦", avatar: "/current-avatar.png" }} />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("现为")).toBeInTheDocument();
  expect(dialog.getByRole("img", { name: "白鸦" })).toHaveAttribute("src", "/current-avatar.png");
});

test("当前RP清除时不追加账号回退说明，历史身份仍在", async () => {
  render(<ThreadIdentityCard {...base} />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("白鸦")).toBeInTheDocument();
  expect(dialog.getAllByText("小明")).toHaveLength(1);
  expect(dialog.queryByText("当前使用站内资料")).not.toBeInTheDocument();
  expect(dialog.queryByText("现为")).not.toBeInTheDocument();
});

test("加载失败保留重试与关闭操作", async () => {
  const retry = vi.fn();
  const view = render(<ThreadIdentityCard {...base} loading />);
  await userEvent.click(screen.getByRole("button", { name: "白鸦" }));
  expect(screen.getByRole("status")).toHaveTextContent("正在更新当前身份");
  view.rerender(<ThreadIdentityCard {...base} error onRetry={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("当前身份加载失败");
  await userEvent.click(screen.getByRole("button", { name: "重试" }));
  expect(retry).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: "关闭" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
