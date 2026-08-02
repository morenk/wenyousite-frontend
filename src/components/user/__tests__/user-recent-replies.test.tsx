/** UserRecentReplies 组件测试：加载/空/列表/错误状态 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UserRecentReplies } from "@/components/user/user-recent-replies";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

afterEach(() => cleanup());

const sampleReplies = [
  {
    id: "r1",
    createdAt: "2026-01-01T00:00:00Z",
    floorNumber: 1,
    parentPostId: null,
    content: "楼层回复内容",
    threadId: "t1",
    thread: { title: "测试帖" },
    subthreadId: "s1",
    subthread: { title: "测试帖" },
    preview: "楼层回复内容",
  },
  {
    id: "r2",
    createdAt: "2026-01-02T00:00:00Z",
    floorNumber: null,
    parentPostId: "f1",
    content: "楼中楼内容",
    threadId: "t1",
    thread: { title: "测试帖" },
    subthreadId: "s1",
    subthread: { title: "测试帖" },
    preview: "楼中楼内容",
  },
  {
    id: "r3",
    createdAt: "2026-01-03T00:00:00Z",
    floorNumber: null,
    parentPostId: null,
    content: "这是子贴正文内容",
    threadId: "t2",
    thread: { title: "正文帖" },
    subthreadId: "s2",
    subthread: { title: "正文帖" },
    preview: "这是子贴正文内容",
  },
];

describe("UserRecentReplies", () => {
  test("加载中显示加载提示", () => {
    render(<UserRecentReplies replies={[]} isLoading error={false} />);
    expect(screen.getByText("加载中…")).toBeInTheDocument();
  });

  test("错误显示未公开占位", () => {
    render(<UserRecentReplies replies={[]} isLoading={false} error />);
    expect(screen.getByText("该用户未公开最近动态")).toBeInTheDocument();
  });

  test("空列表显示空状态", () => {
    render(<UserRecentReplies replies={[]} isLoading={false} error={false} />);
    expect(screen.getByText("还没有发布过回复")).toBeInTheDocument();
  });

  test("渲染回复列表，正文/楼层/楼中楼标识正确", () => {
    render(
      <UserRecentReplies replies={sampleReplies} isLoading={false} error={false} />,
    );
    expect(screen.getByText("楼层回复内容")).toBeInTheDocument();
    expect(screen.getByText("楼中楼内容")).toBeInTheDocument();
    expect(screen.getByText("这是子贴正文内容")).toBeInTheDocument();
    expect(screen.getAllByTestId("reply-kind").map((el) => el.textContent)).toEqual([
      "#1",
      "楼中楼",
      "正文",
    ]);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  test("只显示最近 5 条", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      id: `r${i}`,
      createdAt: `2026-01-0${i + 1}T00:00:00Z`,
      floorNumber: i + 1,
      parentPostId: null,
      content: `内容${i}`,
      threadId: "t1",
      thread: { title: "测试帖" },
      subthreadId: "s1",
      subthread: { title: "测试帖" },
      preview: `内容${i}`,
    }));
    render(<UserRecentReplies replies={many} isLoading={false} error={false} />);
    expect(screen.getByText("内容0")).toBeInTheDocument();
    expect(screen.queryByText("内容6")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("reply-kind")).toHaveLength(5);
  });
});
