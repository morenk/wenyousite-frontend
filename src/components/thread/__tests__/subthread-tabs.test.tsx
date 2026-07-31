/** SubthreadTabs 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SubthreadTabs } from "@/components/thread/subthread-tabs";
import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";

afterEach(() => cleanup());

function makeSub(overrides: Partial<SubthreadDetail> = {}): SubthreadDetail {
  return {
    id: "s1",
    threadId: "t1",
    title: "主帖",
    sortOrder: 0,
    postingPolicy: "PARTICIPANTS",
    version: 1,
    lastPostAt: null,
    bodyPostId: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: null,
    _count: { posts: 5 },
    tags: [],
    ...overrides,
  };
}

describe("SubthreadTabs", () => {
  test("单子贴时不渲染 Tab", () => {
    const { container } = render(
      <SubthreadTabs
        subthreads={[makeSub()]}
        selectedId="s1"
        onChange={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("多子贴时渲染所有 Tab", () => {
    render(
      <SubthreadTabs
        subthreads={[
          makeSub({ id: "s1", title: "主帖" }),
          makeSub({ id: "s2", title: "设定区" }),
        ]}
        selectedId="s1"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("主帖")).toBeInTheDocument();
    expect(screen.getByText("设定区")).toBeInTheDocument();
  });

  test("选中 Tab 高亮", () => {
    render(
      <SubthreadTabs
        subthreads={[
          makeSub({ id: "s1", title: "主帖" }),
          makeSub({ id: "s2", title: "设定区" }),
        ]}
        selectedId="s1"
        onChange={() => {}}
      />,
    );
    const selected = screen.getByText("主帖");
    expect(selected.className).toContain("border-primary");
    const unselected = screen.getByText("设定区");
    expect(unselected.className).toContain("border-transparent");
  });

  test("点击 Tab 调用 onChange", () => {
    const onChange = vi.fn();
    render(
      <SubthreadTabs
        subthreads={[
          makeSub({ id: "s1", title: "主帖" }),
          makeSub({ id: "s2", title: "设定区" }),
        ]}
        selectedId="s1"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("设定区"));
    expect(onChange).toHaveBeenCalledWith("s2");
  });

  test("显示子贴楼层数", () => {
    render(
      <SubthreadTabs
        subthreads={[
          makeSub({ id: "s1", title: "主帖", _count: { posts: 10 } }),
          makeSub({ id: "s2", title: "设定区", _count: { posts: 0 } }),
        ]}
        selectedId="s1"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("10")).toBeInTheDocument();
    // _count.posts === 0 时不显示数字
    expect(screen.queryByText("0")).toBeNull();
  });

  test("0 个帖子的子贴不显示计数", () => {
    render(
      <SubthreadTabs
        subthreads={[
          makeSub({ id: "s1", title: "主帖", _count: { posts: 0 } }),
          makeSub({ id: "s2", title: "设定区", _count: { posts: 0 } }),
        ]}
        selectedId="s1"
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText("0")).toBeNull();
  });
});
