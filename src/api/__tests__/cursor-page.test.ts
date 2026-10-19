import { describe, expect, test } from "vitest";
import { emptyCursorPage, getNextCursor } from "../cursor-page";

describe("游标响应", () => {
  test("空页独立且停止分页", () => {
    const first = emptyCursorPage<string>();
    const second = emptyCursorPage<string>();
    first.data.push("只在第一页");
    expect(second.data).toEqual([]);
    expect(getNextCursor(second)).toBeUndefined();
  });
  test("仅在服务端声明有下一页且提供游标时继续，不解释游标", () => {
    expect(getNextCursor({ meta: { hasMore: true, cursor: "opaque+/=游标" } })).toBe("opaque+/=游标");
    expect(getNextCursor({ meta: { hasMore: false, cursor: "stale" } })).toBeUndefined();
    expect(getNextCursor({ meta: { hasMore: true, cursor: null } })).toBeUndefined();
    expect(getNextCursor(undefined)).toBeUndefined();
  });
});
