import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useThreadCategories } from "@/api/hooks/use-thread-categories";
import { createQueryWrapper } from "@/test/query-client";

const { mockGET } = vi.hoisted(() => ({ mockGET: vi.fn() }));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET },
}));

beforeEach(() => vi.clearAllMocks());

describe("useThreadCategories", () => {
  test("读取管理员配置的动态分类", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: [
          {
            id: "category-mystery",
            slug: "MYSTERY",
            name: "悬疑",
            description: null,
            color: "#7C3AED",
            icon: null,
            sortOrder: 10,
            isActive: true,
            createdAt: "2026-08-08T00:00:00.000Z",
            updatedAt: "2026-08-08T00:00:00.000Z",
          },
        ],
      },
      error: undefined,
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useThreadCategories(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/thread-categories");
    expect(result.current.data?.[0]).toMatchObject({
      slug: "MYSTERY",
      name: "悬疑",
    });
  });

  test("空响应进入错误状态", async () => {
    mockGET.mockResolvedValue({ data: undefined, error: undefined });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useThreadCategories(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error("主题帖分类响应为空"));
  });
});
