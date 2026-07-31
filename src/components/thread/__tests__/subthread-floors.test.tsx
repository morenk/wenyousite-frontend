/** SubthreadFloors 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubthreadFloors } from "@/components/thread/subthread-floors";
import type { PostData } from "@/api/hooks/use-floors";

const { mockUseFloors } = vi.hoisted(() => ({
  mockUseFloors: vi.fn(),
}));

vi.mock("@/api/hooks/use-floors", () => ({
  useFloors: mockUseFloors,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeFloor(
  id: string,
  content: string,
  floorNumber: number | null,
  parentPostId: string | null = null,
): PostData {
  return {
    id,
    threadId: "t1",
    subthreadId: "s1",
    authorId: "u1",
    floorNumber,
    parentPostId,
    replyToPostId: null,
    content,
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    deletedAt: null,
    author: { id: "u1", username: "me", avatar: null },
    _count: { replies: 0 },
    replies: [],
  };
}

function mockFloors(floors: PostData[]) {
  mockUseFloors.mockReturnValue({
    data: {
      pages: [{ data: floors, meta: { cursor: null, hasMore: false } }],
    },
    isLoading: false,
    isError: false,
  });
}

const baseProps = {
  subthreadId: "s1",
  onEditFloor: vi.fn(),
  onDeleteFloor: vi.fn(),
  onAddFloor: vi.fn(),
};

describe("SubthreadFloors", () => {
  test("加载中显示 spinner", () => {
    mockUseFloors.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    render(<SubthreadFloors {...baseProps} />);
    expect(screen.getByText("加载楼层…")).toBeInTheDocument();
  });

  test("加载失败显示错误", () => {
    mockUseFloors.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    render(<SubthreadFloors {...baseProps} />);
    expect(screen.getByText("楼层加载失败")).toBeInTheDocument();
  });

  test("空楼层显示提示", () => {
    mockFloors([]);
    render(<SubthreadFloors {...baseProps} canManage />);
    expect(screen.getByText("该子贴暂无楼层")).toBeInTheDocument();
  });

  test("渲染楼层内容与楼层号", () => {
    mockFloors([makeFloor("p1", "第一楼内容", 1), makeFloor("p2", "第二楼内容", 2)]);
    render(<SubthreadFloors {...baseProps} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("第一楼内容")).toBeInTheDocument();
    expect(screen.getByText("第二楼内容")).toBeInTheDocument();
  });

  test("点击编辑按钮调用 onEditFloor 并传入楼层", async () => {
    const user = userEvent.setup();
    const onEditFloor = vi.fn();
    const floor = makeFloor("p1", "内容", 1);
    mockFloors([floor]);

    render(
      <SubthreadFloors
        subthreadId="s1"
        canManage
        onEditFloor={onEditFloor}
        onDeleteFloor={vi.fn()}
        onAddFloor={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("编辑楼层"));
    expect(onEditFloor).toHaveBeenCalledWith(floor);
  });

  test("点击删除按钮调用 onDeleteFloor 并传入楼层", async () => {
    const user = userEvent.setup();
    const onDeleteFloor = vi.fn();
    const floor = makeFloor("p2", "内容", 2);
    mockFloors([floor]);

    render(
      <SubthreadFloors
        subthreadId="s1"
        canManage
        onEditFloor={vi.fn()}
        onDeleteFloor={onDeleteFloor}
        onAddFloor={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("删除楼层"));
    expect(onDeleteFloor).toHaveBeenCalledWith(floor);
  });

  test("首楼（body post）不显示删除按钮", () => {
    mockFloors([makeFloor("p1", "首楼", 1), makeFloor("p2", "二楼", 2)]);
    render(<SubthreadFloors {...baseProps} canManage />);

    const floorDivs = screen.getAllByTitle("删除楼层");
    expect(floorDivs).toHaveLength(1);
  });

  test("canManage 为 false 时不显示操作按钮与添加按钮", () => {
    mockFloors([makeFloor("p1", "内容", 1)]);
    render(<SubthreadFloors {...baseProps} />);

    expect(screen.queryByTitle("编辑楼层")).not.toBeInTheDocument();
    expect(screen.queryByTitle("删除楼层")).not.toBeInTheDocument();
    expect(screen.queryByText("添加楼层")).not.toBeInTheDocument();
  });

  test("canManage 为 true 时显示添加按钮并调用 onAddFloor", async () => {
    const user = userEvent.setup();
    const onAddFloor = vi.fn();
    mockFloors([]);

    render(
      <SubthreadFloors
        subthreadId="s1"
        canManage
        onEditFloor={vi.fn()}
        onDeleteFloor={vi.fn()}
        onAddFloor={onAddFloor}
      />,
    );

    expect(screen.getByText("添加楼层")).toBeInTheDocument();
    await user.click(screen.getByText("添加楼层"));
    expect(onAddFloor).toHaveBeenCalledTimes(1);
  });
});
