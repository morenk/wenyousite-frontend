import { fireEvent, render, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useAdminAppeals: vi.fn(),
  useResolveAdminAppeal: vi.fn(),
  useAdminAuditLogs: vi.fn(),
  useAdminSettings: vi.fn(),
  useUpdateAdminSettings: vi.fn(),
  useAdminTaxonomy: vi.fn(),
  useAdminTaxonomyActions: vi.fn(),
  useNotificationCampaigns: vi.fn(),
  useNotificationCampaignActions: vi.fn(),
  useAdminUsers: vi.fn(),
  useAdminUserActions: vi.fn(),
  useAdminDashboard: vi.fn(),
  useAcceptAdminInvite: vi.fn(),
  useAdminCases: vi.fn(),
  useAdminCase: vi.fn(),
  useResolveAdminCase: vi.fn(),
  useAdminSession: vi.fn(),
  useAdminAccounts: vi.fn(),
  useAdminAccountActions: vi.fn(),
  useAdminUserSearch: vi.fn(),
}));

vi.mock("@/api/hooks/use-admin", () => hooks);
vi.mock("@/components/admin/high-risk-gate", () => ({ HighRiskGate: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/ui/confirm-provider", () => ({ useConfirm: () => vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("token=invite-token"),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { username: "tester" }, logout: vi.fn() }) }));

import { AppealsPanel } from "@/components/admin/appeals-panel";
import { AuditPanel } from "@/components/admin/audit-panel";
import { OperationsSettingsPanel } from "@/components/admin/operations-settings-panel";
import { TaxonomyPanel } from "@/components/admin/taxonomy-panel";
import { AnnouncementsPanel } from "@/components/admin/announcements-panel";
import { UsersPanel } from "@/components/admin/users-panel";
import { AdminDashboardPanel } from "@/components/admin/admin-dashboard-panel";
import { AdminInviteAcceptance } from "@/components/admin/admin-invite-acceptance";
import { CaseWorkbench } from "@/components/admin/case-workbench";
import { AdminAccountsPanel } from "@/components/admin/admin-accounts-panel";

function mutation() {
  return { mutateAsync: vi.fn(), isPending: false };
}

function renderWithUrl(panel: React.ReactNode, searchParams = "") {
  return render(
    <NuqsTestingAdapter searchParams={searchParams} hasMemory>
      {panel}
    </NuqsTestingAdapter>,
  );
}

describe("station panels", () => {
  beforeEach(() => {
    hooks.useAdminAppeals.mockReturnValue({ data: { items: [], meta: { cursor: null, hasMore: false } }, isLoading: false, isFetching: false });
    hooks.useResolveAdminAppeal.mockReturnValue(mutation());
    hooks.useAdminAuditLogs.mockReturnValue({ data: { items: [], meta: { cursor: null, hasMore: false } }, isLoading: false, isFetching: false });
    hooks.useAdminSettings.mockReturnValue({
      data: {
        registrationPausedUntil: null,
        contentWritesPausedUntil: null,
        maintenanceTitle: null,
        maintenanceContent: null,
        maintenanceStartsAt: null,
        maintenanceEndsAt: null,
      },
      isLoading: false,
    });
    hooks.useUpdateAdminSettings.mockReturnValue(mutation());
    hooks.useAdminTaxonomy.mockReturnValue({ data: { categories: [], tags: [] }, isLoading: false });
    hooks.useAdminTaxonomyActions.mockReturnValue({ createCategory: mutation(), updateCategory: mutation(), createTag: mutation(), updateTag: mutation() });
    hooks.useNotificationCampaigns.mockReturnValue({ data: { items: [], meta: { cursor: null, hasMore: false } }, isLoading: false, isFetching: false });
    hooks.useNotificationCampaignActions.mockReturnValue({ preview: mutation(), create: mutation(), cancel: mutation() });
    hooks.useAdminUsers.mockReturnValue({ data: { items: [], meta: { cursor: null, hasMore: false } }, isLoading: false, isFetching: false });
    hooks.useAdminUserActions.mockReturnValue({ sanction: mutation(), revoke: mutation() });
    hooks.useAcceptAdminInvite.mockReturnValue(mutation());
    hooks.useAdminDashboard.mockReturnValue({
      isLoading: false,
      data: {
        overview: {
          range: { from: "2026-08-01", to: "2026-08-09" },
          activity: { dau: 8, wau: 20, mau: 42 },
          snapshot: { totalUsers: 42, pendingReports: 3, activeSuspensions: 1, activeBans: 0 },
          current: { activeUsers: 20, newUsers: 4, publishedThreads: 3, newPosts: 9, reportsReceived: 3, reportsHandled: 2 },
          previous: { activeUsers: 18, newUsers: 2, publishedThreads: 4, newPosts: 7, reportsReceived: 1, reportsHandled: 1 },
        },
        timeseries: { items: [{ date: "2026-08-09", dau: 8, newUsers: 1, publishedThreads: 1, newPosts: 2, reportsReceived: 3, reportsHandled: 2 }] },
        distributions: {},
        health: { status: "ok", info: { database: { status: "up" }, redis: { status: "up" } } },
      },
    });
    hooks.useAdminCases.mockReturnValue({ data: { items: [], meta: { cursor: null, hasMore: false } }, isLoading: false, isFetching: false });
    hooks.useAdminCase.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    hooks.useResolveAdminCase.mockReturnValue(mutation());
    hooks.useAdminSession.mockReturnValue({ data: { user: { id: "admin-1", username: "admin", role: "SUPER_ADMIN" } } });
    hooks.useAdminAccounts.mockReturnValue({ data: { accounts: [], invites: [] }, isLoading: false, isError: false });
    hooks.useAdminAccountActions.mockReturnValue({ invite: mutation(), cancelInvite: mutation(), revoke: mutation(), transfer: mutation() });
    hooks.useAdminUserSearch.mockReturnValue({ data: [], isLoading: false });
  });

  it("renders the main empty states without inventing parallel UI primitives", () => {
    const panels = [
      <AppealsPanel key="appeals" />,
      <AuditPanel key="audit" />,
      <OperationsSettingsPanel key="operations" />,
      <TaxonomyPanel key="taxonomy" />,
      <AnnouncementsPanel key="announcements" />,
      <UsersPanel key="users" />,
      <AdminDashboardPanel key="dashboard" />,
      <AdminInviteAcceptance key="invite" />,
      <CaseWorkbench key="cases" />,
      <AdminAccountsPanel key="accounts" />,
    ];
    for (const panel of panels) {
      const view = renderWithUrl(panel);
      expect(view.container).not.toBeEmptyDOMElement();
      view.unmount();
    }
  });

  it("所有远程列表使用契约筛选和 20 条游标分页", () => {
    renderWithUrl(<AppealsPanel />);
    renderWithUrl(<AuditPanel />);
    renderWithUrl(<AnnouncementsPanel />);
    renderWithUrl(<UsersPanel />);

    expect(hooks.useAdminAppeals).toHaveBeenCalledWith(expect.objectContaining({ status: "PENDING", limit: 20 }));
    expect(hooks.useAdminAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
    expect(hooks.useNotificationCampaigns).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
    expect(hooks.useAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  it("后台登记册统一使用带中文名称的传统表格", () => {
    const panels = [
      { panel: <CaseWorkbench />, name: "治理案件队列" },
      { panel: <AppealsPanel />, name: "申诉台账" },
      { panel: <UsersPanel />, name: "用户列表" },
      { panel: <AnnouncementsPanel />, name: "通知发送计划" },
      { panel: <AuditPanel />, name: "决定轨迹" },
      { panel: <TaxonomyPanel />, name: "主题帖分类" },
      { panel: <AdminAccountsPanel />, name: "现有站务账号" },
    ];

    for (const { panel, name } of panels) {
      const view = renderWithUrl(panel);
      expect(within(view.container).getByRole("table", { name })).toBeInTheDocument();
      view.unmount();
    }
  });

  it("用户表格用中文列展示记录并提供明确管理入口", () => {
    hooks.useAdminUsers.mockReturnValue({
      data: {
        items: [{
          id: "user-1",
          username: "小温",
          email: "wen@example.com",
          role: "USER",
          emailVerified: true,
          moderationStatus: "ACTIVE",
          currentSanction: null,
          createdAt: "2026-08-11T08:00:00.000Z",
        }],
        meta: { cursor: null, hasMore: false },
      },
      isLoading: false,
      isFetching: false,
    });

    const view = renderWithUrl(<UsersPanel />);
    const panel = within(view.container);
    expect(panel.getByRole("columnheader", { name: "用户" })).toBeInTheDocument();
    expect(panel.getByText("普通用户")).toBeInTheDocument();
    fireEvent.click(panel.getByRole("button", { name: "管理" }));
    expect(panel.getByRole("button", { name: "已选择" })).toBeInTheDocument();
  });
});
