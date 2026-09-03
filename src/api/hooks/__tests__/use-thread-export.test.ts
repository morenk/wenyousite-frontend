import { describe, expect, test } from "vitest";

import { filenameFromResponse } from "@/api/hooks/use-thread-export";

describe("filenameFromResponse", () => {
  test("优先解析 UTF-8 标题文件名", () => {
    const response = new Response(null, {
      headers: {
        "content-disposition":
          "attachment; filename=\"wenyou-thread-export.zip\"; filename*=UTF-8''%E6%98%9F%E6%B5%B7%20%E7%AC%AC%E4%B8%80%E7%AB%A0.zip",
      },
    });

    expect(filenameFromResponse(response, "thread-1")).toBe("星海 第一章.zip");
  });

  test("UTF-8 文件名损坏时回退兼容文件名", () => {
    const response = new Response(null, {
      headers: {
        "content-disposition":
          'attachment; filename="wenyou-thread-export.zip"; filename*=UTF-8\'\'%E0%A4%A',
      },
    });

    expect(filenameFromResponse(response, "thread-1")).toBe("wenyou-thread-export.zip");
  });
});
