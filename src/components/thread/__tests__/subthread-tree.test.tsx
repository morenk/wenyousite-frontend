/** SubthreadTree 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubthreadTree } from "@/components/thread/subthread-tree";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeSub(
  id: string,
  title: string,
  postingPolicy: "PARTICIPANTS" | "COLLABORATORS" | "PLAYERS" = "PARTICIPANTS",
): SubthreadDetail {
  return {
    id,
    threadId: "t1",
    title,
    sortOrder: 0,
    postingPolicy,
    version: 1,
    lastPostAt: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: null,
    _count: { posts: 0 },
    tags: [],
  };
}

const subthreads = [
  makeSub("s1", "公告"),
  makeSub("s2", "设定区", "COLLABORATORS"),
  makeSub("s3", "剧情区", "PLAYERS"),
];

const baseProps = {
  subthreads,
  defaultSubthreadId: "s1",
  onSelect: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onReorder: vi.fn(),
  onCreate: vi.fn(),
};

describe("SubthreadTree", () => {
  test("渲染所有子贴标题", () => {
    render(<SubthreadTree {...baseProps} />);
    expect(screen.getByText("公告")).toBeInTheDocument();
    expect(screen.getByText("设定区")).toBeInTheDocument();
    expect(screen.getByText("剧情区")).toBeInTheDocument();
  });

  test("默认子贴显示'主帖'徽章", () => {
    render(<SubthreadTree {...baseProps} />);
    expect(screen.getByText("主帖")).toBeInTheDocument();
  });

  test("渲染发帖权限标签", () => {
    render(<SubthreadTree {...baseProps} />);
    expect(screen.getByText("参与人")).toBeInTheDocument();
    expect(screen.getByText("协作者")).toBeInTheDocument();
    expect(screen.getByText("玩家")).toBeInTheDocument();
  });

  test("selectedId 匹配的子贴高亮", () => {
    render(<SubthreadTree {...baseProps} selectedId="s2" />);
    const node = screen.getByText("设定区").closest("div");
    expect(node).toHaveClass("bg-primary/10");
  });

  test("点击子贴调用 onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SubthreadTree {...baseProps} onSelect={onSelect} />);

    await user.click(screen.getByText("设定区"));
    expect(onSelect).toHaveBeenCalledWith("s2");
  });

  test("点击编辑按钮调用 onEdit 并传入子贴", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<SubthreadTree {...baseProps} onEdit={onEdit} />);

    await user.click(screen.getAllByTitle("编辑子贴")[1]);
    expect(onEdit).toHaveBeenCalledWith(subthreads[1]);
  });

  test("默认子贴不显示删除按钮", () => {
    render(<SubthreadTree {...baseProps} />);
    expect(screen.getAllByTitle("删除子贴")).toHaveLength(2);
  });

  test("点击删除按钮调用 onDelete", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<SubthreadTree {...baseProps} onDelete={onDelete} />);

    await user.click(screen.getAllByTitle("删除子贴")[0]);
    expect(onDelete).toHaveBeenCalledWith(subthreads[1]);
  });

  test("点击添加子贴按钮调用 onCreate", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<SubthreadTree {...baseProps} onCreate={onCreate} />);

    await user.click(screen.getByText("添加子贴"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
