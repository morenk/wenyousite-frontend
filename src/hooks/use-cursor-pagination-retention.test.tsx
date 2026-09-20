import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { clearAdminListPagination, useCursorPagination } from "./use-cursor-pagination";

afterEach(clearAdminListPagination);
describe("管理列表游标恢复", () => {
  it("详情往返保留访问栈，筛选改变立即回到第一页", () => {
    const first = renderHook(() => useCursorPagination("user-a", "admin-content"));
    act(() => first.result.current.next("opaque-2"));
    act(() => first.result.current.next("opaque-3"));
    first.unmount();
    const second = renderHook(({ scope }) => useCursorPagination(scope, "admin-content"), { initialProps: { scope: "user-a" } });
    expect(second.result.current.page).toBe(3);
    expect(second.result.current.cursor).toBe("opaque-3");
    act(() => second.result.current.previous());
    expect(second.result.current.cursor).toBe("opaque-2");
    second.rerender({ scope: "user-b" });
    expect(second.result.current.page).toBe(1);
    expect(second.result.current.cursor).toBeUndefined();
    second.rerender({ scope: "user-a" });
    expect(second.result.current.page).toBe(1);
    expect(second.result.current.cursor).toBeUndefined();
    second.rerender({ scope: "user-b" });
    second.unmount();
    const third = renderHook(() => useCursorPagination("user-b", "admin-content"));
    expect(third.result.current.page).toBe(1);
  });
  it("退出后清除访问栈", () => {
    const first = renderHook(() => useCursorPagination("all", "admin-users"));
    act(() => first.result.current.next("opaque-next"));
    first.unmount();
    clearAdminListPagination();
    const next = renderHook(() => useCursorPagination("all", "admin-users"));
    expect(next.result.current.page).toBe(1);
  });
});
