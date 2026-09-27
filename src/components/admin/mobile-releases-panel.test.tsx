import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMobileRelease } from "@/api/hooks/admin/use-admin-mobile-releases";
import { queryKeys } from "@/api/query-keys";

const mocks = vi.hoisted(() => ({
  GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(),
  role: "SUPER_ADMIN" as "ADMIN" | "SUPER_ADMIN",
  sessionStatus: "authenticated",
}));
vi.mock("@/api/client", () => ({ apiClient: mocks }));
vi.mock("@/api/hooks/admin/use-admin-auth", () => ({ useAdminSession: () => ({ sessionStatus: mocks.sessionStatus, data: { user: { role: mocks.role } } }) }));

import { MobileReleasesPanel } from "./mobile-releases-panel";

const initial: AdminMobileRelease = {
  id: "release-97", platform: "android", versionName: "0.8.0", buildNumber: 97,
  summary: "原摘要", items: ["原条目"], revision: 1, status: "DRAFT", hasUnconfirmedChanges: true,
  publishing: false, confirmed: null, published: null,
  createdAt: "2026-09-26T08:00:00Z", updatedAt: "2026-09-26T08:00:00Z",
};
let record: AdminMobileRelease;
let clients: QueryClient[] = [];
const reply = (data: unknown, meta?: object) => ({ data: { data, ...(meta ? { meta } : {}) } });
const rejected = (code: number, message: string) => ({ error: { code, message, data: null } });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  clients.push(client);
  const view = render(<QueryClientProvider client={client}><MobileReleasesPanel /></QueryClientProvider>);
  return { ...view, client };
}
async function openRecord() {
  fireEvent.click(await screen.findByRole("button", { name: "查看" }));
  await screen.findByDisplayValue(record.versionName);
  return within(screen.getByRole("dialog", { name: "版本说明" }));
}
function publishedRecord() {
  record = { ...record, status: "PUBLISHED", hasUnconfirmedChanges: false,
    confirmed: { summary: "旧公开摘要", items: ["旧公开条目"], revision: 1, confirmedAt: initial.updatedAt },
    published: { platform: "android", versionName: record.versionName, buildNumber: 97, summary: "旧公开摘要", items: ["旧公开条目"], revision: 1, publishedAt: initial.updatedAt },
    summary: "旧公开摘要", items: ["旧公开条目"],
  };
}
beforeEach(() => {
  mocks.role = "SUPER_ADMIN"; mocks.sessionStatus = "authenticated";
  vi.clearAllMocks(); record = structuredClone(initial);
  mocks.GET.mockImplementation(async (path: string) => path.endsWith("/{id}") ? reply(record) : reply([record], { cursor: null, hasMore: false }));
  mocks.POST.mockImplementation(async (path: string, { body }) => {
    if (path.endsWith("/confirm")) {
      record = { ...record, status: record.published ? "PUBLISHED" : "READY", hasUnconfirmedChanges: false,
        confirmed: { summary: record.summary, items: record.items, revision: record.revision, confirmedAt: initial.updatedAt },
        published: record.published ? { ...record.published, summary: record.summary, items: record.items, revision: record.revision } : null };
    } else record = { ...record, ...body };
    return reply(record);
  });
  mocks.PATCH.mockImplementation(async (_path: string, { body }) => {
    record = { ...record, ...body, revision: record.revision + 1, hasUnconfirmedChanges: true, status: record.published ? "PUBLISHED" : "DRAFT" };
    return reply(record);
  });
});
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients = []; });

describe("移动端版本管理（真实 hooks 与表单，模拟 API）", () => {
  it("首次失败可重试，空历史不伪造记录", async () => {
    mocks.GET.mockResolvedValueOnce(rejected(50000, "暂不可用")).mockResolvedValue(reply([], { cursor: null, hasMore: false }));
    setup();
    expect(screen.getByRole("status")).toHaveTextContent("正在读取移动端版本");
    await screen.findByText("移动端版本加载失败");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await screen.findByText("当前筛选下没有移动端版本");
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
  });

  it("普通管理员可创建草稿，校验失败不提交，条目按原序发送", async () => {
    mocks.role = "ADMIN";
    setup(); fireEvent.click(screen.getByRole("button", { name: "新建版本说明" }));
    const dialog = within(screen.getByRole("dialog", { name: "新建版本说明" }));
    fireEvent.click(dialog.getByRole("button", { name: "保存草稿" }));
    await dialog.findByText("请输入更新摘要");
    expect(mocks.POST).not.toHaveBeenCalled();
    fireEvent.change(dialog.getByLabelText("Android 版本名"), { target: { value: "1.0.0" } });
    fireEvent.change(dialog.getByLabelText("构建号"), { target: { value: "98" } });
    fireEvent.change(dialog.getByLabelText("更新摘要"), { target: { value: "新功能" } });
    fireEvent.change(dialog.getByLabelText("逐条更新内容"), { target: { value: " 第一项\n\n第二项 " } });
    fireEvent.click(dialog.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(mocks.POST).toHaveBeenCalledWith("/api/v1/admin/mobile-releases", { body: { platform: "android", versionName: "1.0.0", buildNumber: 98, summary: "新功能", items: ["第一项", "第二项"] } }));
    await screen.findByRole("dialog", { name: "版本说明" });
    expect(screen.queryByRole("button", { name: "确认说明" })).not.toBeInTheDocument();
  });

  it("保存后使用返回修订确认，普通确认不会显示已发布", async () => {
    setup(); const dialog = await openRecord();
    fireEvent.change(dialog.getByLabelText("更新摘要"), { target: { value: "新摘要" } });
    expect(dialog.getByRole("button", { name: "确认说明" })).toBeDisabled();
    fireEvent.click(dialog.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "确认说明" })).toBeEnabled());
    fireEvent.click(dialog.getByRole("button", { name: "确认说明" }));
    await dialog.findByText("待发布");
    expect(mocks.POST).toHaveBeenCalledWith("/api/v1/admin/mobile-releases/{id}/confirm", { params: { path: { id: record.id } }, body: { revision: 2 } });
    expect(dialog.queryByText("已发布", { exact: true })).not.toBeInTheDocument();
    expect(dialog.getByLabelText("Android 版本名")).toHaveAttribute("readonly");
    expect(dialog.getByLabelText("构建号")).toHaveAttribute("readonly");
  });

  it("已发布修正保存期间保护旧公开快照，确认后使用服务端新快照", async () => {
    publishedRecord(); setup(); const dialog = await openRecord();
    const publicPreview = () => within(dialog.getByRole("region", { name: "当前公开说明" }));
    fireEvent.change(dialog.getByLabelText("更新摘要"), { target: { value: "修正摘要" } });
    fireEvent.click(dialog.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "确认修正并更新公开说明" })).toBeEnabled());
    expect(publicPreview().getByText("旧公开摘要")).toBeInTheDocument();
    expect(publicPreview().queryByText("修正摘要")).not.toBeInTheDocument();
    expect(mocks.PATCH.mock.calls[0][1].body).not.toHaveProperty("versionName");
    fireEvent.click(dialog.getByRole("button", { name: "确认修正并更新公开说明" }));
    await waitFor(() => expect(publicPreview().getByText("修正摘要")).toBeInTheDocument());
    expect(record.published?.publishedAt).toBe(initial.updatedAt);
  });

  it("普通管理员只能查看已发布说明", async () => {
    publishedRecord(); mocks.role = "ADMIN"; setup(); const dialog = await openRecord();
    expect(dialog.getByLabelText("更新摘要")).toBeDisabled();
    expect(dialog.queryByRole("button", { name: "保存草稿" })).not.toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "确认修正并更新公开说明" })).not.toBeInTheDocument();
  });

  it.each([40300, 40001])("服务端 %s 拒绝保留输入并反馈", async (code) => {
    mocks.PATCH.mockResolvedValue(rejected(code, code === 40001 ? "summary 超出限制" : "权限不足"));
    setup(); const dialog = await openRecord();
    fireEvent.change(dialog.getByLabelText("更新摘要"), { target: { value: "未保存输入" } });
    fireEvent.click(dialog.getByRole("button", { name: "保存草稿" }));
    await dialog.findByText(code === 40001 ? "summary 超出限制" : "权限不足");
    expect(dialog.getByLabelText("更新摘要")).toHaveValue("未保存输入");
    if (code === 40001) expect(dialog.getByLabelText("更新摘要")).toHaveAttribute("aria-invalid", "true");
  });

  it("冲突保留输入，刷新核对后携带最新修订保存", async () => {
    mocks.PATCH.mockResolvedValueOnce(rejected(40900, "发生竞争"));
    setup(); const dialog = await openRecord();
    fireEvent.change(dialog.getByLabelText("更新摘要"), { target: { value: "我的输入" } });
    fireEvent.click(dialog.getByRole("button", { name: "保存草稿" }));
    const reload = await dialog.findByRole("button", { name: "读取最新内容" });
    expect(dialog.getByRole("button", { name: "保存草稿" })).toBeDisabled();
    record = { ...record, revision: 4, summary: "他人的新稿" };
    fireEvent.click(reload);
    await dialog.findByText("他人的新稿");
    expect(dialog.getByLabelText("更新摘要")).toHaveValue("我的输入");
    fireEvent.click(dialog.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(mocks.PATCH).toHaveBeenLastCalledWith("/api/v1/admin/mobile-releases/{id}", expect.objectContaining({ body: expect.objectContaining({ revision: 4, summary: "我的输入" }) })));
  });

  it("保存与确认中的双击不会重复提交或关闭弹窗", async () => {
    let finish!: (value: unknown) => void;
    mocks.PATCH.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    setup(); const dialog = await openRecord();
    fireEvent.change(dialog.getByLabelText("更新摘要"), { target: { value: "保存中" } });
    const submit = dialog.getByRole("button", { name: "保存草稿" });
    fireEvent.click(submit); fireEvent.click(submit);
    await waitFor(() => expect(mocks.PATCH).toHaveBeenCalledTimes(1));
    expect(dialog.getByRole("button", { name: "关闭版本说明" })).toBeDisabled();
    await act(async () => finish(reply({ ...record, revision: 2, summary: "保存中" })));
    await waitFor(() => expect(dialog.getByRole("button", { name: "确认说明" })).toBeEnabled());
    mocks.POST.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const confirm = dialog.getByRole("button", { name: "确认说明" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(mocks.POST).toHaveBeenCalledTimes(1));
    await act(async () => finish(reply({ ...record, revision: 2, hasUnconfirmedChanges: false, status: "READY" })));
  });

  it("游标原样传递，上一页回到已访问页；无效游标可返回首页", async () => {
    mocks.GET.mockImplementation(async (_path, { params }) => {
      if (params.query.cursor) return rejected(40007, "游标无效");
      return reply([record], { cursor: "opaque:/+=", hasMore: true });
    });
    setup(); await screen.findByRole("button", { name: "查看" });
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    await screen.findByText("分页已失效，重试将返回第一页。");
    expect(mocks.GET).toHaveBeenCalledWith("/api/v1/admin/mobile-releases", expect.objectContaining({ params: { query: { platform: "android", limit: 20, cursor: "opaque:/+=" } } }));
    fireEvent.click(screen.getByRole("button", { name: "上一页" }));
    await screen.findByRole("button", { name: "查看" });
    await waitFor(() => expect(screen.getByRole("button", { name: "下一页" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    await screen.findByText("分页已失效，重试将返回第一页。");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await screen.findByRole("button", { name: "查看" });
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
  });

  it("后台刷新发现另一管理员确认或发布时保留输入并要求重新核对", async () => {
    const { client } = setup(); const dialog = await openRecord();
    fireEvent.change(dialog.getByLabelText("Android 版本名"), { target: { value: "1.0.1" } });
    fireEvent.change(dialog.getByLabelText("更新摘要"), { target: { value: "保留我的文案" } });
    record = { ...record, confirmed: { summary: record.summary, items: record.items, revision: 1, confirmedAt: initial.updatedAt } };
    await act(async () => { client.setQueryData(queryKeys.admin.mobileRelease(record.id), record); });
    await waitFor(() => expect(dialog.getByRole("button", { name: "保存草稿" })).toBeDisabled());
    expect(dialog.getByLabelText("Android 版本名")).toHaveValue("1.0.1");
    expect(dialog.getByRole("button", { name: "读取最新内容" })).toBeEnabled();
    fireEvent.click(dialog.getByRole("button", { name: "读取最新内容" }));
    await dialog.findByRole("region", { name: "最新服务端草稿（输入已保留，请核对）" });
    expect(dialog.getByRole("button", { name: "保存草稿" })).toBeDisabled();
    fireEvent.click(dialog.getByRole("button", { name: `采用已确认版本名 ${record.versionName}` }));
    expect(dialog.getByLabelText("Android 版本名")).toHaveValue(record.versionName);
    expect(dialog.getByLabelText("更新摘要")).toHaveValue("保留我的文案");
    await waitFor(() => expect(dialog.getByRole("button", { name: "保存草稿" })).toBeEnabled());
  });

  it("详情首次读取失败可在同一弹窗重试", async () => {
    let fail = true;
    mocks.GET.mockImplementation(async (path: string) => path.endsWith("/{id}") ? fail ? rejected(50000, "暂不可用") : reply(record) : reply([record], { cursor: null, hasMore: false }));
    setup(); fireEvent.click(await screen.findByRole("button", { name: "查看" }));
    await screen.findByText("版本说明读取失败");
    fail = false; fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await screen.findByDisplayValue(record.versionName);
  });

  it("确认冲突与刷新失败均保留输入，不显示确认成功", async () => {
    mocks.POST.mockResolvedValueOnce(rejected(40900, "修订变化"));
    setup(); const dialog = await openRecord();
    fireEvent.click(dialog.getByRole("button", { name: "确认说明" }));
    await dialog.findByRole("button", { name: "读取最新内容" });
    mocks.GET.mockResolvedValueOnce(rejected(50000, "读取失败，请重试"));
    fireEvent.click(dialog.getByRole("button", { name: "读取最新内容" }));
    await dialog.findByText("读取失败，请重试");
    expect(dialog.getByLabelText("更新摘要")).toHaveValue("原摘要");
    expect(dialog.queryByText("待发布", { exact: true })).not.toBeInTheDocument();
  });

  it("重复构建号的创建错误绑定字段，保留草稿", async () => {
    mocks.POST.mockResolvedValueOnce(rejected(40900, "重复构建号"));
    setup(); fireEvent.click(screen.getByRole("button", { name: "新建版本说明" }));
    const dialog = within(screen.getByRole("dialog", { name: "新建版本说明" }));
    for (const [label, value] of [["Android 版本名", "1.0"], ["构建号", "97"], ["更新摘要", "摘要"], ["逐条更新内容", "条目"]]) {
      fireEvent.change(dialog.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(dialog.getByRole("button", { name: "保存草稿" }));
    await dialog.findByText("此平台与构建号可能已存在，请刷新列表核对后再创建。");
    expect(dialog.getByLabelText("构建号")).toHaveAttribute("aria-invalid", "true");
    expect(dialog.getByLabelText("更新摘要")).toHaveValue("摘要");
  });

  it("发布锁禁止编辑与确认", async () => {
    record.publishing = true; setup(); const dialog = await openRecord();
    expect(dialog.getByRole("status")).toHaveTextContent("版本正在发布");
    expect(dialog.getByLabelText("逐条更新内容")).toBeDisabled();
    expect(dialog.getByRole("button", { name: "确认说明" })).toBeDisabled();
  });
});
