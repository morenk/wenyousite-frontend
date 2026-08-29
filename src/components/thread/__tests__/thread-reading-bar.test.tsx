/** ThreadReadingBar 组件测试：越过排头卡后提供紧凑帖内导航。 */

import type { ComponentProps, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { SubthreadDetail } from "@/api/hooks/use-thread-detail";
import { ThreadReadingBar } from "@/components/thread/thread-reading-bar";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    nav: ({
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...props
    }: ComponentProps<"nav"> & Record<string, unknown>) => {
      void _initial;
      void _animate;
      void _exit;
      void _transition;
      return <nav {...props} />;
    },
  },
}));

let intersectionCallback: IntersectionObserverCallback;
const disconnect = vi.fn();

class TestIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = disconnect;
  takeRecords = () => [];
  root = null;
  rootMargin = "0px";
  thresholds = [0];
}

const subthread: SubthreadDetail = {
  id: "sub-1",
  threadId: "thread-1",
  title: "主帖",
  sortOrder: 0,
  postingPolicy: "PARTICIPANTS",
  postingCapability: { canPost: true, denialReason: null },
  version: 1,
  lastPostAt: null,
  deletedAt: null,
  createdAt: "2026-08-11T00:00:00.000Z",
  bodyPost: null,
  _count: { posts: 12 },
};

function publishIntersection(isIntersecting: boolean, bottom: number) {
  act(() => {
    intersectionCallback(
      [{ isIntersecting, boundingClientRect: { bottom } } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

describe("ThreadReadingBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: TestIntersectionObserver,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(cleanup);

  test("排头卡离开视口后省略主题标题并显示子贴、最新、搜索与回顶操作", () => {
    const onSearch = vi.fn();
    const onJumpToLatest = vi.fn();
    render(
      <>
        <header data-slot="thread-detail-header" />
        <ThreadReadingBar
          subthreads={[subthread]}
          selectedSubthreadId="sub-1"
          onSubthreadChange={() => {}}
          onSearch={onSearch}
          isSearchOpen={false}
          onJumpToLatest={onJumpToLatest}
        />
      </>,
    );

    expect(screen.queryByRole("navigation", { name: "帖内阅读导航" })).toBeNull();
    publishIntersection(false, -1);

    const navigation = screen.getByRole("navigation", {
      name: "帖内阅读导航",
    });
    expect(navigation).toHaveTextContent("主帖");
    expect(navigation).not.toHaveTextContent("很长的主题帖标题");
    fireEvent.click(screen.getByRole("button", { name: "跳到最新发言" }));
    expect(onJumpToLatest).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "搜索本帖" }));
    expect(onSearch).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "回到主题帖开头" }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });

    publishIntersection(true, 20);
    expect(screen.queryByRole("navigation", { name: "帖内阅读导航" })).toBeNull();
  });

  test("卸载时停止观察排头卡", () => {
    const { unmount } = render(
      <>
        <header data-slot="thread-detail-header" />
        <ThreadReadingBar
          subthreads={[subthread]}
          selectedSubthreadId="sub-1"
          onSubthreadChange={() => {}}
          onSearch={() => {}}
          isSearchOpen
        />
      </>,
    );

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  test("最新发言加载中或主题无楼层时禁用入口", () => {
    const { rerender } = render(
      <>
        <header data-slot="thread-detail-header" />
        <ThreadReadingBar
          subthreads={[subthread]}
          selectedSubthreadId="sub-1"
          onSubthreadChange={() => {}}
          onSearch={() => {}}
          isSearchOpen={false}
          onJumpToLatest={() => {}}
          latestAvailable={false}
        />
      </>,
    );
    publishIntersection(false, -1);
    expect(screen.getByRole("button", { name: "跳到最新发言" })).toBeDisabled();

    rerender(
      <>
        <header data-slot="thread-detail-header" />
        <ThreadReadingBar
          subthreads={[subthread]}
          selectedSubthreadId="sub-1"
          onSubthreadChange={() => {}}
          onSearch={() => {}}
          isSearchOpen={false}
          onJumpToLatest={() => {}}
          latestPending
        />
      </>,
    );
    const pendingButton = screen.getByRole("button", {
      name: "跳到最新发言",
    });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute("aria-busy", "true");
  });
});
