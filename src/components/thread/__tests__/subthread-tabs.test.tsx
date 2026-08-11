/** SubthreadSwitcher 组件测试：头部目录按钮与大量子贴菜单。 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubthreadSwitcher } from "@/components/thread/subthread-tabs";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

function makeSub(overrides: Partial<SubthreadDetail> = {}): SubthreadDetail {
  return {
    id: "s1",
    threadId: "t1",
    title: "主帖",
    sortOrder: 0,
    postingPolicy: "PARTICIPANTS",
    version: 1,
    lastPostAt: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: null,
    _count: { posts: 5 },
    ...overrides,
  };
}

afterEach(cleanup);

describe("SubthreadSwitcher", () => {
  test("单子贴时不渲染切换按钮", () => {
    const { container } = render(
      <SubthreadSwitcher
        subthreads={[makeSub()]}
        selectedId="s1"
        onChange={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("按钮展示当前子贴与楼层数，选项仅在菜单展开后出现", async () => {
    const user = userEvent.setup();
    render(
      <SubthreadSwitcher
        subthreads={[
          makeSub({ id: "s1", title: "主帖", _count: { posts: 10 } }),
          makeSub({ id: "s2", title: "设定区", _count: { posts: 0 } }),
        ]}
        selectedId="s1"
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "切换子贴，当前：主帖" })).toHaveTextContent(
      "主帖10 楼",
    );
    expect(screen.queryByRole("menuitem", { name: /设定区/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "切换子贴，当前：主帖" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("共 2 个子贴")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "主帖 10 楼" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("menuitem", { name: "设定区 0 楼" })).toBeInTheDocument();
  });

  test("点击菜单项切换并关闭菜单", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SubthreadSwitcher
        subthreads={[
          makeSub({ id: "s1", title: "主帖" }),
          makeSub({ id: "s2", title: "设定区" }),
        ]}
        selectedId="s1"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "切换子贴，当前：主帖" }));
    await user.click(screen.getByRole("menuitem", { name: "设定区 5 楼" }));

    expect(onChange).toHaveBeenCalledWith("s2");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("左右游标切换相邻子贴，并在首尾禁用", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const subthreads = [
      makeSub({ id: "s1", title: "主帖" }),
      makeSub({ id: "s2", title: "设定区" }),
      makeSub({ id: "s3", title: "闲聊区" }),
    ];
    const { rerender } = render(
      <SubthreadSwitcher
        subthreads={subthreads}
        selectedId="s2"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "上一个子贴：主帖" }));
    await user.click(screen.getByRole("button", { name: "下一个子贴：闲聊区" }));
    expect(onChange).toHaveBeenNthCalledWith(1, "s1");
    expect(onChange).toHaveBeenNthCalledWith(2, "s3");

    rerender(
      <SubthreadSwitcher
        subthreads={subthreads}
        selectedId="s1"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("button", { name: "已经是第一个子贴" })).toBeDisabled();

    rerender(
      <SubthreadSwitcher
        subthreads={subthreads}
        selectedId="s3"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("button", { name: "已经是最后一个子贴" })).toBeDisabled();
  });

  test("几十个子贴收纳在固定高度的纵向菜单中", async () => {
    const user = userEvent.setup();
    const subthreads = Array.from({ length: 40 }, (_, index) => makeSub({
      id: `s${index + 1}`,
      title: `章节 ${index + 1}`,
      sortOrder: index,
      _count: { posts: index },
    }));
    render(
      <SubthreadSwitcher
        subthreads={subthreads}
        selectedId="s20"
        onChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "切换子贴，当前：章节 20" }));

    expect(screen.getByText("共 40 个子贴")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "章节 40 39 楼" })).toBeInTheDocument();
    expect(screen.getByRole("menu").querySelector(".max-h-80")).toHaveClass(
      "overflow-y-auto",
    );
    expect(screen.getByRole("button", { name: "上一个子贴：章节 19" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "下一个子贴：章节 21" })).toBeEnabled();
  });

  test("支持键盘打开、方向键选择和 Esc 关闭", async () => {
    const user = userEvent.setup();
    render(
      <SubthreadSwitcher
        subthreads={[
          makeSub({ id: "s1", title: "主帖" }),
          makeSub({ id: "s2", title: "设定区" }),
        ]}
        selectedId="s1"
        onChange={() => {}}
      />,
    );

    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "设定区 5 楼" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切换子贴，当前：主帖" })).toHaveFocus();
  });
});
