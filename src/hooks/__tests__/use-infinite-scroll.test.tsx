import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

let observerCallback: IntersectionObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();

class IntersectionObserverMock {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }

  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = "200px 0px";
  thresholds = [0.1];
}

function Probe({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const ref = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
  });
  return <div ref={ref}>哨兵</div>;
}

beforeEach(() => {
  observe.mockReset();
  disconnect.mockReset();
  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useInfiniteScroll", () => {
  test("进入预取区域时加载下一页", () => {
    const onLoadMore = vi.fn();
    render(
      <Probe
        hasNextPage
        isFetchingNextPage={false}
        onLoadMore={onLoadMore}
      />,
    );

    expect(observe).toHaveBeenCalledOnce();
    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  test("请求进行中或没有下一页时不重复加载", () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <Probe hasNextPage isFetchingNextPage onLoadMore={onLoadMore} />,
    );

    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(onLoadMore).not.toHaveBeenCalled();

    rerender(
      <Probe
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={onLoadMore}
      />,
    );
    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
