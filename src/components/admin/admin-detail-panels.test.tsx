import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminContentDetail } from "@/api/hooks/use-admin";
const mocks = vi.hoisted(() => ({
  detail: { data: undefined as AdminContentDetail | undefined, isLoading: false, isError: false, refetch: vi.fn() },
  userError: false, userLoading: false, refetchUser: vi.fn(),
  hide: vi.fn(), restore: vi.fn(), sanction: vi.fn(), revoke: vi.fn(),
  returnTo: "/station/content?authorId=user-1&type=post",
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams({ returnTo: mocks.returnTo }) }));
vi.mock("@/api/hooks/use-admin", () => ({
  useAdminContentDetail: () => mocks.detail,
  useAdminTaxonomy: () => ({ data: { categories: [{ slug: "RPG", name: "角色扮演" }], tags: [] } }),
  useAdminContentActions: () => ({ hide: { mutateAsync: mocks.hide, isPending: false }, restore: { mutateAsync: mocks.restore, isPending: false } }),
  useAdminUserActions: () => ({ sanction: { mutateAsync: mocks.sanction, isPending: false }, revoke: { mutateAsync: mocks.revoke, isPending: false } }),
  useAdminUserDetail: () => ({ data: { id: "user-1", username: "正常用户", email: "user@example.test", role: "USER", moderationStatus: "ACTIVE", currentSanction: null, bio: "公开简介", level: 3, createdAt: "2026-09-20", lastActiveDate: null, contentCounts: { thread: 2, post: 3, moment: 4, moment_comment: 5 } }, isError: mocks.userError, isLoading: mocks.userLoading, refetch: mocks.refetchUser }),
}));
vi.mock("@/components/thread/markdown-content", () => ({ MarkdownContent: ({ content }: { content: string }) => <div data-testid="safe-markdown">{content}</div> }));
import { ContentDetailPanel } from "./content-detail-panel";
import { UserDetailPanel } from "./user-detail-panel";
const item: AdminContentDetail = { id: "content-1", type: "post", title: null, summary: "公开正文", content: "公开正文", author: { id: "user-1", username: "正常用户" }, createdAt: "2026-09-20", updatedAt: "2026-09-20", hidden: false, parentHidden: false, canRestore: false, restoreBlockedReason: null, threadId: "thread-1", parentPostId: "parent-1", momentId: null, parentCommentId: null, category: "RPG", tags: [{ id: "tag-1", name: "旧标签", isActive: false }], version: null, mediaIds: [], media: [], auditLogs: [] };
beforeEach(() => { vi.clearAllMocks(); mocks.detail.data = { ...item }; mocks.detail.isError = false; mocks.detail.isLoading = false; mocks.userError = false; mocks.userLoading = false; mocks.returnTo = "/station/content?authorId=user-1&type=post"; });
afterEach(cleanup);
describe("独立管理详情", () => {
  it("父级和作者入口保留列表来源，父级隐藏时禁止恢复", () => {
    mocks.detail.data = { ...item, hidden: true, parentHidden: true, restoreBlockedReason: "所属主题帖已隐藏" };
    render(<ContentDetailPanel type="post" id={item.id} />);
    expect(screen.getByRole("link", { name: "返回内容列表" })).toHaveAttribute("href", mocks.returnTo);
    expect(screen.getByRole("link", { name: "所属主题帖" })).toHaveAttribute("href", "/station/content/thread/thread-1?returnTo=" + encodeURIComponent(mocks.returnTo));
    expect(screen.getByRole("link", { name: "上级楼层" })).toHaveAttribute("href", "/station/content/post/parent-1?returnTo=" + encodeURIComponent(mocks.returnTo));
    expect(screen.getByRole("button", { name: "恢复" })).toBeDisabled();
    expect(screen.getByText("所属主题帖已隐藏")).toBeInTheDocument();
    expect(screen.getByText("#旧标签（停用）")).toBeInTheDocument();
  });
  it("详情加载与拒绝不会露出已缓存正文，可重试", async () => {
    mocks.detail.data = undefined; mocks.detail.isLoading = true;
    const view = render(<ContentDetailPanel type="post" id={item.id} />);
    expect(screen.getByRole("status")).toHaveTextContent("正在读取内容");
    mocks.detail.data = item; mocks.detail.isLoading = false; mocks.detail.isError = true;
    view.rerender(<ContentDetailPanel type="post" id={item.id} />);
    expect(screen.queryByText("公开正文")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "隐藏" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(mocks.detail.refetch).toHaveBeenCalledOnce();
  });
  it("隐藏失败保留理由，再次成功关闭表单", async () => {
    mocks.hide.mockRejectedValueOnce(new Error("暂时无法隐藏")).mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<ContentDetailPanel type="post" id={item.id} />);
    await user.click(screen.getByRole("button", { name: "隐藏" }));
    await user.type(screen.getByRole("textbox", { name: "理由" }), "复核后隐藏");
    await user.click(screen.getByRole("button", { name: "确认隐藏" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("暂时无法隐藏"));
    expect(screen.getByRole("textbox", { name: "理由" })).toHaveValue("复核后隐藏");
    await user.click(screen.getByRole("button", { name: "确认隐藏" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.hide).toHaveBeenLastCalledWith({ type: "post", id: item.id, reason: "复核后隐藏" });
  });
  it("纯文本动态中的附件URL不吞掉附件，审计动作用中文", () => {
    mocks.detail.data = { ...item, type: "moment_comment", content: "# 字面正文 https://media.example.test/a.png", threadId: null, momentId: "moment-1", parentCommentId: "comment-1", media: [{ id: "media-1", url: "https://media.example.test/a.png", display: null }], auditLogs: [{ id: "audit-1", reportId: null, action: "THREAD_TAXONOMY_UPDATED", targetType: "THREAD", targetId: "thread-1", reason: "整理标签", metadata: {}, createdAt: "2026-09-20", actor: { id: "a", username: "管理员", role: "ADMIN" } }] };
    render(<ContentDetailPanel type="moment_comment" id={item.id} />);
    expect(screen.getByText(/# 字面正文/)).toBeInTheDocument();
    expect(screen.getByTestId("safe-markdown")).toHaveTextContent("![附件 1](https://media.example.test/a.png)");
    expect(screen.getByRole("link", { name: "所属动态" })).toHaveAttribute("href", "/station/content/moment/moment-1?returnTo=" + encodeURIComponent(mocks.returnTo));
    expect(screen.getByText("整理分类与标签")).toBeInTheDocument();
  });
  it("用户详情显示四类关联入口，账号状态操作验证结束时间", async () => {
    mocks.sanction.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<UserDetailPanel id="user-1" />);
    expect(screen.getByText("暂无记录")).toBeInTheDocument();
    for (const [type, label] of [["thread", "主题帖 2"], ["post", "楼层与回复 3"], ["moment", "动态 4"], ["moment_comment", "动态评论 5"]]) expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", `/station/content?type=${type}&authorId=user-1`);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "修改状态" }));
    await user.type(screen.getByLabelText("处罚理由"), "复核账号状态");
    await user.click(screen.getByRole("button", { name: "暂停账号" }));
    expect(await screen.findByText("暂停账号需要结束时间")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("暂停至"), { target: { value: "2026-10-01T12:00" } });
    await user.click(screen.getByRole("button", { name: "暂停账号" }));
    await waitFor(() => expect(mocks.sanction).toHaveBeenCalledOnce());
    expect(mocks.sanction.mock.calls[0][0]).toMatchObject({ id: "user-1", type: "SUSPENSION", reason: "复核账号状态" });
  });
  it("用户详情错误遮住缓存资料并允许重试", async () => {
    mocks.userError = true;
    render(<UserDetailPanel id="user-1" />);
    expect(screen.queryByText("公开简介")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(mocks.refetchUser).toHaveBeenCalledOnce();
  });
});
