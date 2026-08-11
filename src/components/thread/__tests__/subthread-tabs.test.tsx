/** SubthreadSwitcher 组件测试：头部可检索目录与大量子贴切换。 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByRole("combobox", { name: "切换子贴，当前：主帖" })).toHaveTextContent(
      "主帖10 楼",
    );
    expect(screen.queryByRole("option", { name: /设定区/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "切换子贴，当前：主帖" }));

    expect(screen.getByRole("dialog", { name: "主题目录" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "筛选子贴" })).toHaveFocus();
    });
    expect(screen.getByText("共 2 个子贴")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "主帖 10 楼" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("option", { name: "设定区 0 楼" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("combobox", { name: "切换子贴，当前：主帖" }));
    await user.click(screen.getByRole("option", { name: "设定区 5 楼" }));

    expect(onChange).toHaveBeenCalledWith("s2");
    expect(screen.queryByRole("dialog", { name: "主题目录" })).not.toBeInTheDocument();
  });

  test("目录菜单可复制当前子贴链接", async () => {
    const user = userEvent.setup();
    const onCopyCurrent = vi.fn();
    render(
      <SubthreadSwitcher
        subthreads={[makeSub({ id: "s1" }), makeSub({ id: "s2" })]}
        selectedId="s2"
        onChange={() => {}}
        onCopyCurrent={onCopyCurrent}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /切换子贴/ }));
    await user.click(screen.getByRole("button", { name: "复制当前子贴链接" }));
    expect(onCopyCurrent).toHaveBeenCalledOnce();
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

    await user.click(screen.getByRole("combobox", { name: "切换子贴，当前：章节 20" }));

    expect(screen.getByText("共 40 个子贴")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "章节 40 39 楼" })).toBeInTheDocument();
    expect(screen.getByRole("listbox")).toHaveClass(
      "overflow-y-auto",
    );
    expect(screen.getByRole("button", { name: "上一个子贴：章节 19" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "下一个子贴：章节 21" })).toBeEnabled();
  });

  test("支持键盘打开、方向键选择和 Esc 关闭", async () => {
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

    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "主题目录" })).toBeInTheDocument();
    const input = screen.getByRole("combobox", { name: "筛选子贴" });
    await waitFor(() => expect(input).toHaveFocus());

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: "设定区 5 楼" })).toHaveAttribute(
      "data-keyboard-highlighted",
    );
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("s2");
    expect(screen.queryByRole("dialog", { name: "主题目录" })).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "筛选子贴" })).toHaveFocus());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "主题目录" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "切换子贴，当前：主帖" })).toHaveFocus();
  });

  test("输入标题可筛选大量子贴并显示明确空态", async () => {
    const user = userEvent.setup();
    render(
      <SubthreadSwitcher
        subthreads={[
          makeSub({ id: "s1", title: "序章" }),
          makeSub({ id: "s2", title: "角色设定" }),
          makeSub({ id: "s3", title: "第二幕" }),
        ]}
        selectedId="s1"
        onChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /切换子贴/ }));
    const input = screen.getByRole("combobox", { name: "筛选子贴" });
    await user.type(input, "设定");
    expect(screen.getByRole("option", { name: "角色设定 5 楼" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "序章 5 楼" })).toBeNull();

    await user.clear(input);
    await user.type(input, "不存在");
    expect(screen.getByText("没有匹配的子贴")).toBeInTheDocument();
  });
});
