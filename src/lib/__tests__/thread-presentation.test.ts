import { describe, expect, test } from "vitest";

import { getThreadCategoryPresentation } from "@/lib/thread-presentation";

describe("getThreadCategoryPresentation", () => {
  test("动态分类使用服务端名称", () => {
    expect(
      getThreadCategoryPresentation({
        slug: "MYSTERY",
        name: "悬疑",
        isActive: true,
      }, "MYSTERY"),
    ).toEqual({
      label: "悬疑",
      badgeTone: "neutral",
    });
  });

  test("停用分类仍使用读模型名称", () => {
    expect(getThreadCategoryPresentation({
      slug: "ARCHIVE",
      name: "往期剧场",
      isActive: false,
    }, "ARCHIVE").label).toBe("往期剧场");
  });

  test("旧响应缺少读模型时安全降级", () => {
    expect(getThreadCategoryPresentation(undefined, "ARCHIVE").label).toBe("ARCHIVE");
    expect(getThreadCategoryPresentation(null, null).label).toBe("未分类");
  });
});
