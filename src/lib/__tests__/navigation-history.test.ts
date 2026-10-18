import { afterEach, expect, test, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

test("历史重放只放行已确认目标，队列里的其它遍历仍须恢复并确认", async () => {
  const events = new EventTarget();
  const address = { href: "https://example.test/0" };
  const entries: Array<{ state: unknown; url: string }> = [{ state: { __NA: true }, url: address.href }];
  let index = 0;
  const historyMock = {
    state: entries[0].state,
    go: vi.fn(),
    pushState(state: unknown, _title: string, url: string) {
      index += 1;
      address.href = new URL(url, address.href).href;
      this.state = state;
      entries[index] = { state, url: address.href };
    },
    replaceState(state: unknown, _title: string, url?: string) {
      this.state = state;
      if (url) address.href = new URL(url, address.href).href;
      entries[index] = { state, url: address.href };
    },
  };
  vi.stubGlobal("window", events);
  vi.stubGlobal("history", historyMock);
  vi.stubGlobal("location", address);
  const { trackNavigationHistory } = await import("@/lib/navigation-history");
  const tracker = trackNavigationHistory();
  const request = vi.fn();
  tracker.addBlocker({ isBlocked: () => true, request });
  const delivered = vi.fn();
  events.addEventListener("popstate", delivered);
  historyMock.pushState({ __NA: true, tree: "one" }, "", "/1");
  historyMock.pushState({ __NA: true, tree: "two" }, "", "/2");
  const pop = (target: number) => {
    index = target;
    address.href = entries[target].url;
    historyMock.state = entries[target].state;
    events.dispatchEvent(Object.assign(new Event("popstate"), { state: historyMock.state }));
  };
  pop(0);
  expect(historyMock.go).toHaveBeenLastCalledWith(2);
  expect(delivered).not.toHaveBeenCalled();
  pop(2);
  expect(request).toHaveBeenCalledTimes(1);
  request.mock.calls[0][0]();
  expect(historyMock.go).toHaveBeenLastCalledWith(-2);
  // 重放目标 0 到达前另一个遍历 1 先到，不能被全局布尔许可放行。
  pop(1);
  expect(delivered).not.toHaveBeenCalled();
  expect(historyMock.go).toHaveBeenLastCalledWith(1);
  pop(2);
  expect(request).toHaveBeenCalledTimes(2);
  expect(historyMock.state).toMatchObject({ __NA: true, tree: "two" });
});
