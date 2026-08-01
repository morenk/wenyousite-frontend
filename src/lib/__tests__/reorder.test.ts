/** computeReorderedIds 纯函数测试 */

import { describe, test, expect } from "vitest";
import { computeReorderedIds } from "@/lib/reorder";

describe("computeReorderedIds", () => {
  const ids = ["s1", "s2", "s3", "s4"];

  test("普通子贴间交换返回新顺序", () => {
    // s2 (index 1) 拖到 s3 (index 2)
    expect(computeReorderedIds(ids, "s2", "s3", "s1")).toEqual(["s1", "s3", "s2", "s4"]);
  });

  test("普通子贴拖到后面的位置", () => {
    // s2 拖到 s4 的位置
    expect(computeReorderedIds(ids, "s2", "s4", "s1")).toEqual(["s1", "s3", "s4", "s2"]);
  });

  test("普通子贴拖到主帖位置返回 null（主帖必须首位）", () => {
    // s2 拖到 s1（主帖）位置
    expect(computeReorderedIds(ids, "s2", "s1", "s1")).toBeNull();
  });

  test("拖拽主帖返回 null", () => {
    expect(computeReorderedIds(ids, "s1", "s3", "s1")).toBeNull();
  });

  test("active 与 over 相同返回 null", () => {
    expect(computeReorderedIds(ids, "s2", "s2", "s1")).toBeNull();
  });

  test("id 不在列表中返回 null", () => {
    expect(computeReorderedIds(ids, "s9", "s2", "s1")).toBeNull();
    expect(computeReorderedIds(ids, "s2", "s9", "s1")).toBeNull();
  });

  test("空数组返回 null", () => {
    expect(computeReorderedIds([], "s2", "s3", "s1")).toBeNull();
  });
});
