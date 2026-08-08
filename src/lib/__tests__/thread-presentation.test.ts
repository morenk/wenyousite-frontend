import { describe, expect, test } from "vitest";

import { getThreadCategoryPresentation } from "@/lib/thread-presentation";

describe("getThreadCategoryPresentation", () => {
  test("动态分类使用服务端名称和合法颜色", () => {
    expect(
      getThreadCategoryPresentation("MYSTERY", [
        { slug: "MYSTERY", name: "悬疑", color: "#7c3aed" },
      ]),
    ).toMatchObject({
      label: "悬疑",
      badgeTone: "neutral",
      markerStyle: { backgroundColor: "#7C3AED" },
    });
  });

  test("未知分类安全显示 slug，空分类显示未分类", () => {
    expect(getThreadCategoryPresentation("ARCHIVE", []).label).toBe("ARCHIVE");
    expect(getThreadCategoryPresentation(null, []).label).toBe("未分类");
  });

  test("非法颜色不进入内联样式", () => {
    const result = getThreadCategoryPresentation("CUSTOM", [
      { slug: "CUSTOM", name: "自定义", color: "red;display:none" },
    ]);
    expect(result.badgeStyle).toBeUndefined();
    expect(result.markerStyle).toBeUndefined();
  });
});
