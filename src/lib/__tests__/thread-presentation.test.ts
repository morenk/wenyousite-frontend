import { describe, expect, test } from "vitest";

import { getThreadCategoryPresentation } from "@/lib/thread-presentation";

describe("getThreadCategoryPresentation", () => {
  test("动态分类使用服务端名称", () => {
    expect(
      getThreadCategoryPresentation("MYSTERY", [
        { slug: "MYSTERY", name: "悬疑" },
      ]),
    ).toEqual({
      label: "悬疑",
      badgeTone: "neutral",
    });
  });

  test("未知分类安全显示 slug，空分类显示未分类", () => {
    expect(getThreadCategoryPresentation("ARCHIVE", []).label).toBe("ARCHIVE");
    expect(getThreadCategoryPresentation("DEDUCTION", []).label).toBe("DEDUCTION");
    expect(getThreadCategoryPresentation(null, []).label).toBe("未分类");
  });

});
