import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

import { useAdminTaxonomyActions } from "@/api/hooks/admin/use-admin-configuration";
import { queryKeys } from "@/api/query-keys";

const { mockPATCH, mockPOST } = vi.hoisted(() => ({
  mockPATCH: vi.fn(),
  mockPOST: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { PATCH: mockPATCH, POST: mockPOST },
}));

describe("useAdminTaxonomyActions", () => {
  test("分类改名后失效所有携带分类展示信息的查询", async () => {
    mockPATCH.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: {} },
      error: undefined,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAdminTaxonomyActions(), { wrapper });

    result.current.updateCategory.mutate({ id: "category-1", name: "新名称" });
    await waitFor(() => expect(result.current.updateCategory.isSuccess).toBe(true));

    const invalidatedKeys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(invalidatedKeys).toEqual(expect.arrayContaining([
      queryKeys.admin.taxonomy,
      queryKeys.admin.dashboard,
      queryKeys.threadCategories,
      queryKeys.threads.all,
      queryKeys.threads.details,
      queryKeys.draftState,
      queryKeys.threadDrafts,
      queryKeys.bookmarks.all,
      queryKeys.users.all,
      queryKeys.subscriptions,
      queryKeys.search.all,
      queryKeys.invitePreviews,
    ]));
  });
});
