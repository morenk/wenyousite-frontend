import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
  setAdminCsrfToken: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: api.GET, POST: api.POST, PATCH: api.PATCH, DELETE: api.DELETE },
  setAdminCsrfToken: api.setAdminCsrfToken,
}));

import {
  useAdminAccountActions,
  useAdminAccounts,
  useAdminAppeals,
  useAdminAuditLogs,
  useAdminCase,
  useAdminCases,
  useAdminContentActions,
  useAdminDashboard,
  useAdminLogin,
  useAdminLogout,
  useAdminSession,
  useAdminSettings,
  useAdminStepUp,
  useAdminTaxonomy,
  useAdminTaxonomyActions,
  useAdminUserActions,
  useAdminUserSearch,
  useAdminUsers,
  useNotificationCampaignActions,
  useNotificationCampaigns,
  useResolveAdminAppeal,
  useResolveAdminCase,
  useUpdateAdminSettings,
  useAcceptAdminInvite,
} from "@/api/hooks/use-admin";
import {
  useMyModerationDecisions,
  useSubmitModerationAppeal,
  useSubmitReport,
} from "@/api/hooks/use-moderation-actions";
import { queryKeys } from "@/api/query-keys";

describe("admin query hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const response = { data: { data: [], meta: { cursor: null, hasMore: false } } };
    api.GET.mockResolvedValue(response);
    api.POST.mockResolvedValue(response);
    api.PATCH.mockResolvedValue(response);
    api.DELETE.mockResolvedValue(response);
  });

  it("all station and user moderation hooks register with the shared query client", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => {
      useAdminSession();
      useAdminLogin();
      useAdminLogout();
      useAdminStepUp();
      useAdminCases({ status: "OPEN" });
      useAdminContentActions();
      useAdminCase("case-1");
      useAdminDashboard();
      useResolveAdminCase();
      useAdminAccounts(true);
      useAdminAccountActions();
      useAdminUserSearch("tester");
      useAdminSettings();
      useUpdateAdminSettings();
      useAdminAppeals({ status: "PENDING" });
      useResolveAdminAppeal();
      useAdminUsers({});
      useAdminUserActions();
      useAdminAuditLogs({});
      useAdminTaxonomy();
      useAdminTaxonomyActions();
      useNotificationCampaigns({});
      useNotificationCampaignActions();
      useAcceptAdminInvite();
      useSubmitReport();
      useMyModerationDecisions("user-1");
      useSubmitModerationAppeal("user-1");
      return true;
    }, { wrapper });

    expect(result.current).toBe(true);
  });

  it("分类更新同时使后台登记册和公开分类缓存失效", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(queryKeys.admin.taxonomy, { categories: [], tags: [] });
    client.setQueryData(queryKeys.threadCategories, []);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAdminTaxonomyActions(), { wrapper });

    await act(async () => {
      await result.current.updateCategory.mutateAsync({
        id: "category-1",
        name: "新名称",
      });
    });

    await waitFor(() => {
      expect(client.getQueryState(queryKeys.admin.taxonomy)?.isInvalidated).toBe(true);
      expect(client.getQueryState(queryKeys.threadCategories)?.isInvalidated).toBe(true);
    });
  });

  it("直接隐藏帖子使用站务接口并同步公开内容与审计缓存", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(queryKeys.floors.list("subthread-1"), []);
    client.setQueryData(queryKeys.replies.list("post-1"), []);
    client.setQueryData(queryKeys.posts.detail("post-1"), {});
    client.setQueryData(queryKeys.admin.audits({}), []);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    api.POST.mockResolvedValueOnce({
      data: {
        data: {
          targetType: "POST",
          targetId: "post-1",
          hidden: true,
          deletedAt: "2026-08-13T00:00:00.000Z",
        },
      },
    });
    const { result } = renderHook(() => useAdminContentActions(), { wrapper });

    await act(async () => {
      await result.current.hide.mutateAsync({
        type: "post",
        id: "post-1",
        reason: "违反社区规则",
      });
    });

    expect(api.POST).toHaveBeenCalledWith("/api/v1/admin/content/{type}/{id}/hide", {
      params: { path: { type: "post", id: "post-1" } },
      body: { reason: "违反社区规则" },
    });
    await waitFor(() => {
      expect(client.getQueryState(queryKeys.floors.list("subthread-1"))?.isInvalidated).toBe(true);
      expect(client.getQueryState(queryKeys.replies.list("post-1"))?.isInvalidated).toBe(true);
      expect(client.getQueryState(queryKeys.posts.detail("post-1"))?.isInvalidated).toBe(true);
      expect(client.getQueryState(queryKeys.admin.audits({}))?.isInvalidated).toBe(true);
    });
  });
});
