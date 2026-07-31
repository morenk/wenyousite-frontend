/** SubthreadList 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubthreadList } from "@/components/thread/subthread-list";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeSub(
  id: string,
  title: string,
  sortOrder: number,
): SubthreadDetail {
  return {
    id,
    threadId: "thread-1",
    title,
    sortOrder,
    postingPolicy: "PARTICIPANTS",
    version: 1,
    lastPostAt: null,
    bodyPostId: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: null,
    _count: { posts: 0 },
    tags: [],
  };
}

const subthreads = [
  makeSub("sub-1", "默认子贴", 0),
  makeSub("sub-2", "设定区", 1),
  makeSub("sub-3", "剧情区", 2),
];

describe("SubthreadList", () => {
  test("渲染所有子贴标题", () => {
    render(
      <SubthreadList
        subthreads={subthreads}
        defaultSubthreadId="sub-1"
      />,
    );

    expect(screen.getByText("默认子贴")).toBeInTheDocument();
    expect(screen.getByText("设定区")).toBeInTheDocument();
    expect(screen.getByText("剧情区")).toBeInTheDocument();
  });

  test("默认子贴显示'默认'徽章", () => {
    render(
      <SubthreadList
        subthreads={subthreads}
        defaultSubthreadId="sub-1"
      />,
    );

    expect(screen.getByText("默认")).toBeInTheDocument();
  });

  test("showActions 为 false 时不显示添加按钮", () => {
    render(
      <SubthreadList
        subthreads={subthreads}
        defaultSubthreadId="sub-1"
      />,
    );

    expect(screen.queryByText("添加子贴")).not.toBeInTheDocument();
  });

  test("showActions 为 true 时显示添加按钮", () => {
    render(
      <SubthreadList
        subthreads={subthreads}
        defaultSubthreadId="sub-1"
        showActions
      />,
    );

    expect(screen.getByText("添加子贴")).toBeInTheDocument();
  });

  test("点击添加按钮打开创建表单", async () => {
    const user = userEvent.setup();
    render(
      <SubthreadList
        subthreads={subthreads}
        defaultSubthreadId="sub-1"
        showActions
      />,
    );

    await user.click(screen.getByRole("button", { name: "添加子贴" }));

    expect(
      screen.getByPlaceholderText("主帖 / 设定区 / 剧情区"),
    ).toBeInTheDocument();
  });

  test("提交创建表单后调用 onCreate", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(
      <SubthreadList
        subthreads={subthreads}
        defaultSubthreadId="sub-1"
        showActions
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "添加子贴" }));
    await user.type(screen.getByPlaceholderText("主帖 / 设定区 / 剧情区"), "新子贴");
    await user.click(screen.getByRole("button", { name: /添加$/ }));

    await vi.waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "新子贴" }),
      );
    });
  });

  test("renderFloors 展开时显示内容", () => {
    render(
      <SubthreadList
        subthreads={subthreads}
        defaultSubthreadId="sub-1"
        renderFloors={() => <div>楼层占位</div>}
      />,
    );

    expect(screen.getByText("楼层占位")).toBeInTheDocument(); // 第一个默认展开
  });
});
