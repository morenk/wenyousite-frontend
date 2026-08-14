/** SubthreadBody 组件测试 */

import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SubthreadBody } from "@/components/thread/subthread-body";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

afterEach(() => cleanup());

const baseSubthread: SubthreadDetail = {
  id: "s1",
  threadId: "t1",
  title: "设定区",
  sortOrder: 0,
  postingPolicy: "PARTICIPANTS",
  version: 1,
  lastPostAt: null,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  bodyPost: {
    id: "post-1",
    content: "这是**加粗**的正文",
    version: 1,
    diceRolls: [],
  },
  _count: { posts: 3 },
};

describe("SubthreadBody", () => {
  test("渲染子贴标题", () => {
    render(<SubthreadBody subthread={baseSubthread} />);
    expect(screen.getByRole("heading", { name: "设定区" })).toBeInTheDocument();
  });

  test("渲染一楼正文 Markdown 加粗", () => {
    render(<SubthreadBody subthread={baseSubthread} />);
    const strong = screen.getByText("加粗");
    expect(strong.tagName).toBe("STRONG");
  });

  test("默认子贴显示主帖正文定位", () => {
    render(<SubthreadBody subthread={baseSubthread} isDefault />);
    expect(screen.getByText("主帖正文")).toBeInTheDocument();
  });

  test("非默认子贴显示目录位置", () => {
    render(<SubthreadBody subthread={baseSubthread} position={2} total={4} />);
    expect(screen.getByText("子贴 2 / 4")).toBeInTheDocument();
    expect(screen.queryByText("主帖正文")).toBeNull();
  });

  test("主贴标题与主题标题重复时只在视觉上显示一次", () => {
    render(
      <SubthreadBody
        subthread={baseSubthread}
        isDefault
        threadTitle="设定区"
      />,
    );
    expect(screen.getByRole("heading", { name: "设定区" })).toHaveClass("sr-only");
  });

  test("无正文时显示占位文案", () => {
    const noBody = { ...baseSubthread, bodyPost: null };
    render(<SubthreadBody subthread={noBody} />);
    expect(screen.getByText("暂无正文")).toBeInTheDocument();
  });

  test("正文为空字符串时显示占位文案", () => {
    const emptyBody = {
      ...baseSubthread,
      bodyPost: { id: "post-1", content: "   ", version: 1, diceRolls: [] },
    };
    render(<SubthreadBody subthread={emptyBody} />);
    expect(screen.getByText("暂无正文")).toBeInTheDocument();
  });

  test("仅包含空段落协议时显示占位文案", () => {
    const emptyBody = {
      ...baseSubthread,
      bodyPost: { id: "post-1", content: "<br />\n<br />", version: 1, diceRolls: [] },
    };
    render(<SubthreadBody subthread={emptyBody} />);
    expect(screen.getByText("暂无正文")).toBeInTheDocument();
  });
});
