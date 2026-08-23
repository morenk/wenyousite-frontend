import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  useAdminContentActions: vi.fn(),
  useAdminHiddenContent: vi.fn(),
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
import { ContentModerationPanel } from "@/components/admin/content-moderation-panel";

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
        distributions: {
          usersByRole: [],
          reportsByStatus: [],
          reportsByReason: [],
          threadsByCategory: [
            { key: "RPG", name: "角色扮演", isActive: false, count: 7 },
          ],
          activeSanctionsByType: [],
        },
        health: { status: "ok", info: { database: { status: "up" }, redis: { status: "up" } } },
      },
    });
    hooks.useAdminCases.mockReturnValue({ data: { items: [], meta: { cursor: null, hasMore: false } }, isLoading: false, isFetching: false });
    hooks.useAdminCase.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    hooks.useAdminContentActions.mockReturnValue({ hide: mutation(), restore: mutation() });
    hooks.useAdminHiddenContent.mockReturnValue({
      data: { items: [], meta: { cursor: null, hasMore: false } },
      isLoading: false,
      isFetching: false,
      isError: false,
    });
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
      <ContentModerationPanel key="content" />,
      <AdminAccountsPanel key="accounts" />,
    ];
    for (const panel of panels) {
      const view = renderWithUrl(panel);
      expect(view.container).not.toBeEmptyDOMElement();
      view.unmount();
    }
  });

  it("站务总览用当前名称展示分类分布并标记停用项", () => {
    renderWithUrl(<AdminDashboardPanel />);

    expect(screen.getByText("已发布主题分布")).toBeInTheDocument();
    expect(screen.getByText("角色扮演")).toBeInTheDocument();
    expect(screen.getByText("RPG")).toBeInTheDocument();
    expect(screen.getByText("已停用")).toBeInTheDocument();
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
      { panel: <ContentModerationPanel />, name: "当前隐藏内容" },
      { panel: <TaxonomyPanel />, name: "主题帖分类" },
      { panel: <AdminAccountsPanel />, name: "现有站务账号" },
    ];

    for (const { panel, name } of panels) {
      const view = renderWithUrl(panel);
      expect(within(view.container).getByRole("table", { name })).toBeInTheDocument();
      view.unmount();
    }
  });

  it("列表型站务页只保留全宽台账，不渲染常驻操作栏", () => {
    const panels = [
      <CaseWorkbench key="cases" />,
      <AppealsPanel key="appeals" />,
      <UsersPanel key="users" />,
      <AnnouncementsPanel key="announcements" />,
      <AdminAccountsPanel key="accounts" />,
      <ContentModerationPanel key="content" />,
    ];

    for (const panel of panels) {
      const view = renderWithUrl(panel);
      expect(view.container.querySelector('[data-layout="full-table"]')).toHaveClass("w-full");
      expect(view.container.querySelector('[data-slot="admin-action-rail"]')).not.toBeInTheDocument();
      view.unmount();
    }

    const operations = renderWithUrl(<OperationsSettingsPanel />);
    expect(operations.container.querySelector('[data-slot="admin-operations-workspace"]'))
      .toHaveClass("w-full");
    operations.unmount();
  });

  it("隐藏内容列表展示当前状态并可填写理由直接恢复", async () => {
    const restore = mutation();
    hooks.useAdminContentActions.mockReturnValue({ hide: mutation(), restore });
    hooks.useAdminHiddenContent.mockReturnValue({
      data: {
        items: [{
          targetType: "POST",
          targetId: "post-1",
          summary: "被隐藏的楼层内容",
          author: { id: "user-1", username: "小温" },
          moderator: { id: "admin-1", username: "站务" },
          hiddenAt: "2026-08-14T08:00:00.000Z",
          reason: "违反社区规则",
          canRestore: true,
          restoreBlockedReason: null,
          threadId: "thread-1",
          parentPostId: null,
          momentId: null,
          parentCommentId: null,
        }],
        meta: { cursor: null, hasMore: false },
      },
      isLoading: false,
      isFetching: false,
      isError: false,
    });

    const view = renderWithUrl(<ContentModerationPanel />);
    const panel = within(view.container);
    expect(panel.getByText("被隐藏的楼层内容")).toBeInTheDocument();
    expect(panel.getByText("违反社区规则")).toBeInTheDocument();
    fireEvent.click(panel.getByRole("button", { name: "操作" }));
    expect(screen.getByRole("dialog", { name: "帖子 / 楼层 / 回复操作" })).toHaveAttribute("data-slot", "dialog-popup");
    fireEvent.change(screen.getByLabelText("恢复理由"), { target: { value: "复核后恢复" } });
    fireEvent.click(screen.getByRole("button", { name: "确认恢复" }));

    await waitFor(() => {
      expect(restore.mutateAsync).toHaveBeenCalledWith({
        type: "post",
        id: "post-1",
        reason: "复核后恢复",
      });
    });
  });

  it("用户表格用中文列展示记录并提供明确管理入口", () => {
    hooks.useAdminUsers.mockReturnValue({
      data: {
        items: [{
          id: "user-1",
          username: "小温",
          email: "wen@example.com",
          role: "USER",
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
    const dialog = screen.getByRole("dialog", { name: "管理 小温" });
    expect(dialog).toHaveAttribute("data-admin-action-dialog");
    expect(within(dialog).getByRole("button", { name: "暂停账号" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "永久封禁" })).toBeInTheDocument();
  });

  it("页头创建动作也通过弹窗完成", () => {
    const announcements = renderWithUrl(<AnnouncementsPanel />);
    fireEvent.click(within(announcements.container).getByRole("button", { name: "新建通知" }));
    expect(screen.getByRole("dialog", { name: "新建站内通知" })).toHaveAttribute("data-admin-action-dialog");
    announcements.unmount();

    const accounts = renderWithUrl(<AdminAccountsPanel />);
    fireEvent.click(within(accounts.container).getByRole("button", { name: "邀请站务" }));
    expect(screen.getByRole("dialog", { name: "邀请现有用户" })).toHaveAttribute("data-admin-action-dialog");
    accounts.unmount();

    const content = renderWithUrl(<ContentModerationPanel />);
    fireEvent.click(within(content.container).getByRole("button", { name: "直接处置内容" }));
    expect(screen.getByRole("dialog", { name: "直接处置公开内容" })).toHaveAttribute("data-admin-action-dialog");
  });

  it("申诉只在点击复核后弹出决定操作", () => {
    hooks.useAdminAppeals.mockReturnValue({
      data: {
        items: [{
          id: "appeal-1",
          status: "PENDING",
          statement: "希望站务重新查看上下文",
          createdAt: "2026-08-14T08:00:00.000Z",
          handledAt: null,
          handledNote: null,
          appellant: { id: "user-1", username: "小温" },
          decision: {
            action: "HIDE_CONTENT",
            targetType: "THREAD",
            targetId: "thread-1",
            publicExplanation: "主题内容违反社区规则",
          },
        }],
        meta: { cursor: null, hasMore: false },
      },
      isLoading: false,
      isFetching: false,
    });

    const view = renderWithUrl(<AppealsPanel />);
    expect(screen.queryByRole("dialog", { name: "复核 小温 的申诉" })).not.toBeInTheDocument();
    fireEvent.click(within(view.container).getByRole("button", { name: "复核" }));
    expect(screen.getByRole("dialog", { name: "复核 小温 的申诉" })).toHaveAttribute("data-admin-action-dialog");
  });
});
