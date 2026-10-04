import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ThreadIdentityCard } from "../thread-identity-card";

afterEach(cleanup);
const base = { account: { id: "account-1", username: "小明" }, appearance: { name: "白鸦", avatar: null } };

describe("帖内身份卡", () => {
  test("旧楼层区分发表身份、当前角色名和真实账号", async () => {
    const user = userEvent.setup();
    const opened = vi.fn();
    render(<ThreadIdentityCard {...base} historical currentName="夜渡" onOpen={opened} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看白鸦的帖内身份" }));
    expect(opened).toHaveBeenCalledOnce();
    expect(screen.getByText("本条发言身份")).toBeInTheDocument();
    expect(screen.getByText("当前帖内昵称：夜渡")).toBeInTheDocument();
    expect(screen.getByText("站内账号：小明")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看站内主页" })).toHaveAttribute("href", "/users/account-1");
    expect(screen.queryByRole("button", { name: "提及" })).not.toBeInTheDocument();
  });

  test("提及和筛选关闭卡片后调用各自账号动作", async () => {
    const user = userEvent.setup();
    const mention = vi.fn();
    const filter = vi.fn();
    render(<ThreadIdentityCard {...base} currentName="白鸦" onMention={mention} onFilter={filter} />);
    await user.click(screen.getByRole("button", { name: "白鸦" }));
    expect(screen.queryByText("当前帖内昵称：白鸦")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "提及" }));
    expect(mention).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "白鸦" }));
    await user.click(screen.getByRole("button", { name: "只看此人" }));
    expect(filter).toHaveBeenCalledOnce();
  });

  test("当前身份查询失败不会隐藏账号或历史资料", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const view = render(<ThreadIdentityCard {...base} loading />);
    await user.click(screen.getByRole("button", { name: "白鸦" }));
    expect(screen.getByRole("status")).toHaveTextContent("正在更新当前身份");
    view.rerender(<ThreadIdentityCard {...base} error onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("当前身份加载失败");
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(retry).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
