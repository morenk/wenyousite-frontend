import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/** 默认模拟 v3 兼容回退；对齐特性测试用 server.use 显式覆盖为 v4。 */
export const server = setupServer(
  http.get("*/api/v1/meta", () => HttpResponse.json({
    data: { markdownContractVersion: 3 },
  })),
);
