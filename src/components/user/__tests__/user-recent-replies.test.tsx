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

  test("渲染回复列表，楼层与楼中楼标识正确", () => {
    render(
      <UserRecentReplies replies={sampleReplies} isLoading={false} error={false} />,
    );
    expect(screen.getByText("楼层回复内容")).toBeInTheDocument();
    expect(screen.getByText("楼中楼内容")).toBeInTheDocument();
    expect(screen.getAllByTestId("reply-kind").map((el) => el.textContent)).toEqual(["#1", "楼中楼"]);
    expect(screen.getAllByRole("link", { name: "测试帖" })).toHaveLength(2);
  });
});
