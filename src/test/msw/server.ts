import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/** 默认模拟当前公网的 Markdown v3；特性测试可用 server.use 覆盖为 v4。 */
export const server = setupServer(
  http.get("*/api/v1/meta", () => HttpResponse.json({
    data: { markdownContractVersion: 3 },
  })),
);
