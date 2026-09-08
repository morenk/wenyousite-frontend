import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ThreadCategoryDefinition } from "@/api/hooks/use-thread-categories";

const threadCategories: ThreadCategoryDefinition[] = [{
  id: "category-mystery",
  slug: "MYSTERY",
  name: "悬疑",
  description: null,
  icon: null,
  sortOrder: 10,
  isActive: true,
  mergedIntoId: null,
  createdAt: "2026-08-08T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
}];

/** 默认模拟 v3 兼容回退；对齐特性测试用 server.use 显式覆盖为 v4。 */
export const server = setupServer(
  http.get("*/api/v1/meta", () => HttpResponse.json({
    data: { markdownContractVersion: 3 },
  })),
  http.get("*/api/v1/thread-categories", () => HttpResponse.json({
    code: 0,
    message: "ok",
    data: threadCategories,
  })),
);
