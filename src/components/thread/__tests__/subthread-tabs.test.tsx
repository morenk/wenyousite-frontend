/** SubthreadTabs 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  SubthreadTabs,
  hasOverflow,
} from "@/components/thread/subthread-tabs";
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
    tags: [],
    ...overrides,
  };
}

const origScrollIntoView = Element.prototype.scrollIntoView;

const proto = HTMLElement.prototype as unknown as Record<string, unknown>;

afterEach(() => {
  cleanup();
  delete proto.scrollWidth;
  delete proto.clientWidth;
  delete proto.scrollLeft;
  Element.prototype.scrollIntoView = origScrollIntoView;
});

describe("hasOverflow", () => {
  test("内容未溢出时两侧都不可滚动", () => {
    expect(hasOverflow(300, 300, 0)).toEqual({ left: false, right: false });
  });

  test("内容溢出且未滚动时仅右侧可滚动", () => {
    expect(hasOverflow(1000, 300, 0)).toEqual({ left: false, right: true });
  });

  test("内容溢出且已滚动到末尾时仅左侧可滚动", () => {
    expect(hasOverflow(1000, 300, 700)).toEqual({ left: true, right: false });
  });

  test("内容溢出且滚动在中间时两侧都可滚动", () => {
    expect(hasOverflow(1000, 300, 300)).toEqual({ left: true, right: true });
  });
});

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

  test("非选中子贴有新回复时显示徽标", () => {
    const { container } = render(
      <SubthreadTabs
        subthreads={[
          makeSub({ id: "s1", title: "主帖" }),
          makeSub({ id: "s2", title: "设定区" }),
        ]}
        selectedId="s1"
        onChange={() => {}}
        newRepliesMap={{ s2: 5 }}
      />,
    );
    // 徽标为含 bg-destructive 的红色小圆角
    const badge = container.querySelector("span.bg-destructive");
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe("5");
  });

  test("选中子贴不显示新回复徽标", () => {
    render(
      <SubthreadTabs
        subthreads={[
          makeSub({ id: "s1", title: "主帖" }),
          makeSub({ id: "s2", title: "设定区" }),
        ]}
        selectedId="s1"
        onChange={() => {}}
        newRepliesMap={{ s1: 3 }}
      />,
    );
    expect(screen.queryByText("3")).toBeNull();
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

  test("内容溢出时显示滚动箭头", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollLeft", {
      configurable: true,
      value: 0,
    });
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
    // 未滚动到最左时只有向右箭头
    expect(screen.getByTitle("向右滚动")).toBeInTheDocument();
    expect(screen.queryByTitle("向左滚动")).toBeNull();
  });

  test("未溢出时不显示滚动箭头", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollLeft", {
      configurable: true,
      value: 0,
    });
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
    expect(screen.queryByTitle("向右滚动")).toBeNull();
    expect(screen.queryByTitle("向左滚动")).toBeNull();
  });

  test("选中 Tab 变化时调用 scrollIntoView", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { rerender } = render(
      <SubthreadTabs
        subthreads={[
          makeSub({ id: "s1", title: "主帖" }),
          makeSub({ id: "s2", title: "设定区" }),
        ]}
        selectedId="s1"
        onChange={() => {}}
      />,
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(
      <SubthreadTabs
        subthreads={[
          makeSub({ id: "s1", title: "主帖" }),
          makeSub({ id: "s2", title: "设定区" }),
        ]}
        selectedId="s2"
        onChange={() => {}}
      />,
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
