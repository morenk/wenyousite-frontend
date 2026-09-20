import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminContentDetail } from "@/api/hooks/use-admin";
const mocks = vi.hoisted(() => ({ save: vi.fn(), pending: false }));
vi.mock("@/api/hooks/use-admin", () => ({
  useAdminContentTaxonomy: () => ({ mutateAsync: mocks.save, isPending: mocks.pending }),
  useAdminTaxonomy: () => ({ data: {
    categories: [{ id: "rpg", slug: "RPG", name: "角色扮演", isActive: true }, { id: "other", slug: "OTHER", name: "其他", isActive: true }, { id: "old", slug: "OLD", name: "旧分类", isActive: false }],
    tags: [{ id: "tag-1", name: "旧标签", isActive: false }, { id: "tag-2", name: "新标签", isActive: true }],
  }, isLoading: false }),
}));
import { ContentTaxonomyDialog } from "./content-taxonomy-dialog";
const item: AdminContentDetail = { id: "thread-1", type: "thread", title: "主题", summary: "内容", author: { id: "u", username: "用户" }, createdAt: "2026-09-20", updatedAt: "2026-09-20", hidden: false, parentHidden: false, canRestore: false, restoreBlockedReason: null, threadId: "thread-1", parentPostId: null, momentId: null, parentCommentId: null, category: "RPG", tags: [{ id: "tag-1", name: "旧标签", isActive: false }], version: 1, content: "", mediaIds: [], media: [], auditLogs: [] };
beforeEach(() => { mocks.pending = false; mocks.save.mockReset(); });
afterEach(cleanup);
describe("整理分类与标签", () => {
  it("版本冲突保留输入，读取后显示服务器当前值且使用新版本保存", async () => {
    const user = userEvent.setup();
    mocks.save.mockRejectedValueOnce({ code: 40002 });
    mocks.save.mockResolvedValueOnce({});
    const reload = vi.fn().mockResolvedValue({ ...item, version: 9, category: "OTHER", tags: [] });
    const close = vi.fn();
    render(<ContentTaxonomyDialog item={item} reload={reload} onClose={close} />);
    await user.type(screen.getByLabelText("理由"), "按内容重新分类");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("内容已更新"));
    expect(screen.getByLabelText("理由")).toHaveValue("按内容重新分类");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "读取最新版本" }));
    expect(await screen.findByText("当前分类：其他")).toBeInTheDocument();
    expect(screen.getByText("当前标签：无")).toBeInTheDocument();
    expect(screen.getByLabelText("理由")).toHaveValue("按内容重新分类");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(mocks.save).toHaveBeenLastCalledWith({ id: "thread-1", version: 9, reason: "按内容重新分类", category: "RPG", tagIds: ["tag-1"] });
  });
  it("新选择中排除停用分类，保留已绑定的停用标签", async () => {
    const user = userEvent.setup();
    render(<ContentTaxonomyDialog item={item} reload={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByRole("combobox", { name: "分类" }));
    expect(screen.queryByRole("option", { name: "旧分类（停用）" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("combobox", { name: "标签" }));
    expect(screen.getByRole("option", { name: "旧标签（停用）" })).toBeInTheDocument();
  });
  it("提交期间禁止重复保存及关闭", () => {
    mocks.pending = true;
    render(<ContentTaxonomyDialog item={item} reload={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "关闭分类与标签" })).toBeDisabled();
  });
});
