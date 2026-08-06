/** SubthreadCard 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubthreadCard } from "@/components/thread/subthread-card";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockSubthread: SubthreadDetail = {
  id: "sub-1",
  threadId: "thread-1",
  title: "主帖讨论区",
  sortOrder: 0,
  postingPolicy: "PARTICIPANTS",
  version: 1,
  lastPostAt: null,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  bodyPost: null,
  _count: { posts: 3 },
};

describe("SubthreadCard", () => {
  test("渲染子贴标题", () => {
    render(<SubthreadCard subthread={mockSubthread} />);
    expect(screen.getByText("主帖讨论区")).toBeInTheDocument();
  });

  test("渲染发帖权限标签", () => {
    render(<SubthreadCard subthread={mockSubthread} />);
    expect(screen.getByText("所有人")).toBeInTheDocument();
  });

  test("渲染楼层数量", () => {
    render(<SubthreadCard subthread={mockSubthread} />);
    expect(screen.getByText("3 楼")).toBeInTheDocument();
  });

  test("默认子贴时显示'主帖'徽章", () => {
    render(<SubthreadCard subthread={mockSubthread} isDefault />);
    expect(screen.getByText("主帖")).toBeInTheDocument();
  });

  test("默认不显示操作按钮", () => {
    render(
      <SubthreadCard
        subthread={mockSubthread}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByTitle("编辑子贴")).not.toBeInTheDocument();
  });

  test("showActions 为 true 时显示操作按钮", () => {
    render(
      <SubthreadCard
        subthread={mockSubthread}
        showActions={true}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTitle("编辑子贴")).toBeInTheDocument();
    expect(screen.getByTitle("删除子贴")).toBeInTheDocument();
  });

  test("默认子贴不显示删除按钮", () => {
    render(
      <SubthreadCard
        subthread={mockSubthread}
        isDefault
        showActions={true}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTitle("编辑子贴")).toBeInTheDocument();
    expect(screen.queryByTitle("删除子贴")).not.toBeInTheDocument();
  });

  test("点击标题栏展开/折叠内容", async () => {
    const user = userEvent.setup();
    render(
      <SubthreadCard subthread={mockSubthread}>
        <div>楼层内容</div>
      </SubthreadCard>,
    );

    expect(screen.queryByText("楼层内容")).not.toBeInTheDocument();

    await user.click(screen.getByText("主帖讨论区"));
    expect(screen.getByText("楼层内容")).toBeInTheDocument();

    await user.click(screen.getByText("主帖讨论区"));
    expect(screen.queryByText("楼层内容")).not.toBeInTheDocument();
  });

  test("defaultExpanded 为 true 时默认展开", () => {
    render(
      <SubthreadCard subthread={mockSubthread} defaultExpanded>
        <div>楼层内容</div>
      </SubthreadCard>,
    );
    expect(screen.getByText("楼层内容")).toBeInTheDocument();
  });

  test("点击编辑按钮调用 onEdit", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <SubthreadCard
        subthread={mockSubthread}
        showActions={true}
        onEdit={onEdit}
      />,
    );

    await user.click(screen.getByTitle("编辑子贴"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  test("点击删除按钮调用 onDelete", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <SubthreadCard
        subthread={mockSubthread}
        showActions={true}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByTitle("删除子贴"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
