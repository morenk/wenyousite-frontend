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
  apiClient: {
    GET: api.GET,
    POST: api.POST,
    PATCH: api.PATCH,
    DELETE: api.DELETE,
  },
  setAdminCsrfToken: api.setAdminCsrfToken,
}));

import {
  useAdminAccountActions,
  useAdminAccounts,
  useAdminAppeals,
  useAdminAuditLogs,
  useAdminBearerContentActions,
  useAdminCase,
  useAdminCases,
  useAdminContentActions,
  useAdminDashboard,
  useAdminHiddenContent,
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
    const response = {
      data: { data: [], meta: { cursor: null, hasMore: false } },
    };
    api.GET.mockResolvedValue(response);
    api.POST.mockResolvedValue(response);
    api.PATCH.mockResolvedValue(response);
    api.DELETE.mockResolvedValue(response);
  });

  it("all station and user moderation hooks register with the shared query client", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => {
        useAdminSession();
        useAdminLogin();
        useAdminLogout();
        useAdminStepUp();
        useAdminCases({ status: "OPEN" });
        useAdminContentActions();
        useAdminBearerContentActions();
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
        useAdminHiddenContent({});
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
      },
      { wrapper },
    );

    expect(result.current).toBe(true);
  });

  it("分类更新同时使后台登记册和公开分类缓存失效", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
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
      expect(
        client.getQueryState(queryKeys.admin.taxonomy)?.isInvalidated,
      ).toBe(true);
      expect(
        client.getQueryState(queryKeys.threadCategories)?.isInvalidated,
      ).toBe(true);
    });
  });

  it("直接隐藏帖子使用站务接口并同步公开内容与审计缓存", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(queryKeys.floors.list("subthread-1"), []);
    client.setQueryData(queryKeys.replies.list("post-1"), []);
    client.setQueryData(queryKeys.posts.detail("post-1"), {});
    client.setQueryData(queryKeys.admin.hiddenContent({}), []);
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

    expect(api.POST).toHaveBeenCalledWith(
      "/api/v1/admin/content/{type}/{id}/hide",
      {
        params: { path: { type: "post", id: "post-1" } },
        body: { reason: "违反社区规则" },
      },
    );
    await waitFor(() => {
      expect(
        client.getQueryState(queryKeys.floors.list("subthread-1"))
          ?.isInvalidated,
      ).toBe(true);
      expect(
        client.getQueryState(queryKeys.replies.list("post-1"))?.isInvalidated,
      ).toBe(true);
      expect(
        client.getQueryState(queryKeys.posts.detail("post-1")),
      ).toBeUndefined();
      expect(
        client.getQueryState(queryKeys.admin.hiddenContent({}))?.isInvalidated,
      ).toBe(true);
      expect(
        client.getQueryState(queryKeys.admin.audits({}))?.isInvalidated,
      ).toBe(true);
    });
  });

  it("前台隐藏使用普通 Bearer 管理员接口", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    api.POST.mockResolvedValueOnce({
      data: {
        data: {
          targetType: "MOMENT",
          targetId: "moment-1",
          hidden: true,
          deletedAt: "2026-08-14T00:00:00.000Z",
        },
      },
    });
    const { result } = renderHook(() => useAdminBearerContentActions(), {
      wrapper,
    });

    await act(async () => {
      await result.current.hide.mutateAsync({
        type: "moment",
        id: "moment-1",
        reason: "违反动态区规则",
      });
    });

    expect(api.POST).toHaveBeenCalledWith(
      "/api/v1/moderation/content/{type}/{id}/hide",
      {
        params: { path: { type: "moment", id: "moment-1" } },
        body: { reason: "违反动态区规则" },
      },
    );
  });

  it("隐藏成功不等待后台缓存刷新完成", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(client, "invalidateQueries").mockReturnValue(
      new Promise(() => undefined),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    api.POST.mockResolvedValueOnce({
      data: {
        data: {
          targetType: "THREAD",
          targetId: "thread-1",
          hidden: true,
          deletedAt: "2026-08-14T00:00:00.000Z",
        },
      },
    });
    const { result } = renderHook(() => useAdminContentActions(), { wrapper });

    let completed = false;
    act(() => {
      void result.current.hide
        .mutateAsync({
          type: "thread",
          id: "thread-1",
          reason: "违反社区规则",
        })
        .then(() => {
          completed = true;
        });
    });

    await waitFor(() => expect(completed).toBe(true));
  });

  it("执行认证、提权、退出和邀请接受完整写入链路", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    api.POST.mockImplementation(async (path: string) => {
      if (path.endsWith("/challenge")) {
        return { data: { data: { challengeId: "challenge-1", expiresIn: 300 } } };
      }
      if (path.endsWith("/verify")) {
        return {
          data: {
            data: {
              csrfToken: "csrf-1",
              elevatedUntil: "2026-08-15T01:00:00Z",
              session: {},
              user: { id: "admin-1", username: "站务", role: "SUPER_ADMIN" },
            },
          },
        };
      }
      return { data: { data: {} } };
    });
    const { result } = renderHook(() => ({
      login: useAdminLogin(),
      logout: useAdminLogout(),
      stepUp: useAdminStepUp(),
      invite: useAcceptAdminInvite(),
    }), { wrapper });

    await act(async () => {
      await result.current.login.challenge.mutateAsync({ account: "admin@example.com", password: "password" });
      await result.current.login.verify.mutateAsync({ challengeId: "challenge-1", code: "123456" });
      await result.current.stepUp.challenge.mutateAsync();
      await result.current.stepUp.verify.mutateAsync({ challengeId: "challenge-1", code: "123456" });
      await result.current.invite.mutateAsync("invite-token");
      await result.current.logout.mutateAsync();
    });

    expect(api.setAdminCsrfToken).toHaveBeenCalledWith("csrf-1");
    expect(api.setAdminCsrfToken).toHaveBeenLastCalledWith(null);
  });

  it("执行全部站务列表查询并解析统一 envelope", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    api.GET.mockImplementation(async (path: string) => {
      if (path.endsWith("/auth/session")) {
        return { data: { data: { csrfToken: "csrf", session: {}, user: {} } } };
      }
      if (path.endsWith("/accounts")) {
        return { data: { data: { accounts: [], invites: [] } } };
      }
      if (path.endsWith("/operations/settings")) {
        return { data: { data: { registrationPausedUntil: null } } };
      }
      if (path.endsWith("/users/search")) {
        return { data: { data: { data: [] } } };
      }
      if (path.endsWith("/thread-categories") || path.endsWith("/tags")) {
        return { data: { data: [] } };
      }
      return { data: { data: [], meta: { cursor: null, hasMore: false } } };
    });
    const { result } = renderHook(() => ({
      session: useAdminSession(),
      cases: useAdminCases({ status: "OPEN" }),
      detail: useAdminCase("case-1"),
      accounts: useAdminAccounts(true),
      search: useAdminUserSearch("tester"),
      settings: useAdminSettings(),
      appeals: useAdminAppeals({ status: "PENDING" }),
      users: useAdminUsers({}),
      hidden: useAdminHiddenContent({}),
      audits: useAdminAuditLogs({}),
      taxonomy: useAdminTaxonomy(),
      campaigns: useNotificationCampaigns({}),
    }), { wrapper });

    await waitFor(() => {
      expect(Object.values(result.current).every((query) => query.isSuccess)).toBe(true);
    });
    expect(api.setAdminCsrfToken).toHaveBeenCalledWith("csrf");
  });

  it("执行案件、账号、用户、配置与通知的 mutation", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const response = { data: { data: { id: "result-1", version: 2 } } };
    api.POST.mockResolvedValue(response);
    api.PATCH.mockResolvedValue(response);
    api.DELETE.mockResolvedValue(response);
    const { result } = renderHook(() => ({
      resolveCase: useResolveAdminCase(),
      accounts: useAdminAccountActions(),
      settings: useUpdateAdminSettings(),
      appeal: useResolveAdminAppeal(),
      users: useAdminUserActions(),
      taxonomy: useAdminTaxonomyActions(),
      campaigns: useNotificationCampaignActions(),
    }), { wrapper });

    await act(async () => {
      await result.current.resolveCase.mutateAsync({
        id: "case-1",
        outcome: "DISMISSED",
        policyCode: "OTHER",
        publicExplanation: "不成立",
      });
      await result.current.accounts.invite.mutateAsync("user-1");
      await result.current.accounts.cancelInvite.mutateAsync({ id: "invite-1", reason: "撤销" });
      await result.current.accounts.revoke.mutateAsync({ id: "admin-2", reason: "离任" });
      await result.current.accounts.transfer.mutateAsync({ userId: "admin-2", reason: "交接" });
      await result.current.settings.mutateAsync({ maintenanceTitle: "维护" });
      await result.current.appeal.mutateAsync({ id: "appeal-1", outcome: "UPHELD", note: "维持" });
      await result.current.users.sanction.mutateAsync({ id: "user-1", type: "SUSPENSION", reason: "处理", endsAt: "2026-08-16T00:00:00Z" });
      await result.current.users.revoke.mutateAsync({ id: "user-1", reason: "复核" });
      await result.current.taxonomy.createCategory.mutateAsync({ slug: "TEST", name: "测试", sortOrder: 1, isActive: true, reason: "新增" });
      await result.current.taxonomy.updateCategory.mutateAsync({ id: "category-1", name: "新名称", reason: "更新" });
      await result.current.taxonomy.createTag.mutateAsync({ name: "新标签", sortOrder: 1, isActive: true, reason: "新增" });
      await result.current.taxonomy.updateTag.mutateAsync({ id: "tag-1", name: "标签", reason: "更新" });
      await result.current.campaigns.preview.mutateAsync({ roles: ["USER"] });
      await result.current.campaigns.create.mutateAsync({ title: "通知", content: "内容", audience: { roles: ["USER"] }, scheduledAt: "2026-08-16T00:00:00Z" });
      await result.current.campaigns.cancel.mutateAsync("campaign-1");
    });

    expect(api.POST).toHaveBeenCalled();
    expect(api.PATCH).toHaveBeenCalled();
    expect(api.DELETE).toHaveBeenCalled();
  });
});
