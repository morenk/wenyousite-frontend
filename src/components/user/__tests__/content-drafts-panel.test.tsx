/** ContentDraftsPanel 组件测试：四态/恢复/删除/保存 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseContentDrafts } = vi.hoisted(() => ({
  mockUseContentDrafts: vi.fn(),
}));
const { mockUseDraftSlots } = vi.hoisted(() => ({ mockUseDraftSlots: vi.fn() }));
const { mockUseSaveDraft } = vi.hoisted(() => ({ mockUseSaveDraft: vi.fn() }));
const { mockUseDeleteContentDraft } = vi.hoisted(() => ({
  mockUseDeleteContentDraft: vi.fn(),
}));

vi.mock("@/api/hooks/use-content-drafts", () => ({
  useContentDrafts: () => mockUseContentDrafts(),
}));
vi.mock("@/api/hooks/use-draft-slots", () => ({
  useDraftSlots: () => mockUseDraftSlots(),
}));
vi.mock("@/api/hooks/use-save-draft", () => ({
  useSaveDraft: () => mockUseSaveDraft(),
}));
vi.mock("@/api/hooks/use-delete-content-draft", () => ({
  useDeleteContentDraft: () => mockUseDeleteContentDraft(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { ContentDraftsPanel } from "@/components/user/content-drafts-panel";

const sampleDraft = {
  id: "d1",
  userId: "u1",
  slot: 1,
  content: "这是槽位 1 的正文草稿",
  version: 2,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function defaultQueries() {
  mockUseContentDrafts.mockReturnValue({
    data: [sampleDraft],
    isLoading: false,
    error: undefined,
    refetch: vi.fn(),
  });
  mockUseDraftSlots.mockReturnValue({
    data: { usedSlots: 1, maxSlots: 5, slots: [1] },
  });
  mockUseSaveDraft.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue(sampleDraft),
  });
  mockUseDeleteContentDraft.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({ message: "草稿已删除" }),
  });
}

function renderPanel(props?: Partial<React.ComponentProps<typeof ContentDraftsPanel>>) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ContentDraftsPanel open onClose={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

describe("ContentDraftsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultQueries();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("关闭时不渲染", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ContentDraftsPanel open={false} onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("loading 状态显示加载中", () => {
    mockUseContentDrafts.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
      refetch: vi.fn(),
    });
    renderPanel();
    expect(screen.getByText("正文草稿")).toBeInTheDocument();
    expect(screen.queryByText("槽位 1 空闲")).not.toBeInTheDocument();
  });

  test("error 状态显示重试", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseContentDrafts.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("网络错误"),
      refetch,
    });
    renderPanel();
    await user.click(screen.getByText("重试"));
    expect(refetch).toHaveBeenCalled();
  });

  test("渲染 5 槽位与草稿内容，空闲槽位显示占位", () => {
    renderPanel();
    expect(screen.getByText("这是槽位 1 的正文草稿")).toBeInTheDocument();
    expect(screen.getByText("槽位 2 空闲")).toBeInTheDocument();
    expect(screen.getByText("槽位 5 空闲")).toBeInTheDocument();
    expect(screen.getByText(/已用 1\/5 槽位/)).toBeInTheDocument();
  });

  test("恢复草稿调用 onRestore 并关闭面板", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const onClose = vi.fn();
    renderPanel({ onRestore, onClose });
    await user.click(screen.getByText("恢复"));
    expect(onRestore).toHaveBeenCalledWith(sampleDraft.content);
    expect(onClose).toHaveBeenCalled();
  });

  test("无 onRestore 时复制到剪贴板", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "navigator",
      Object.assign({}, globalThis.navigator, { clipboard: { writeText } }),
    );
    renderPanel();
    await user.click(screen.getByText("恢复"));
    expect(writeText).toHaveBeenCalledWith(sampleDraft.content);
    expect(toast.success).toHaveBeenCalledWith(
      "正文草稿已复制，可粘贴到楼层/回复编辑器",
    );
  });

  test("删除草稿：confirm 确认后调用删除并提示", async () => {
    const user = userEvent.setup();
    const deleteMutate = vi.fn().mockResolvedValue({ message: "草稿已删除" });
    mockUseDeleteContentDraft.mockReturnValue({
      isPending: false,
      mutateAsync: deleteMutate,
    });
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderPanel();
    await user.click(screen.getByRole("button", { name: "删除草稿" }));
    expect(global.confirm).toHaveBeenCalled();
    expect(deleteMutate).toHaveBeenCalledWith("d1");
    expect(toast.success).toHaveBeenCalledWith("正文草稿已删除");
  });

  test("直接显示当前编辑器内容字数，不渲染二次输入框", () => {
    renderPanel({ initialContent: "编辑器里正在写的内容" });
    expect(screen.getByText("当前编辑器：10 个字符")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("可把当前正文保存到指定空槽位", async () => {
    const user = userEvent.setup();
    const saveMutate = vi.fn().mockResolvedValue({ ...sampleDraft, slot: 2 });
    mockUseSaveDraft.mockReturnValue({ isPending: false, mutateAsync: saveMutate });
    renderPanel({ initialContent: "编辑器正文" });
    await user.click(screen.getAllByText("保存到此处")[0]!);
    expect(saveMutate).toHaveBeenCalledWith({ content: "编辑器正文", slot: 2 });
  });

  test("覆盖已用槽位前要求确认", async () => {
    const user = userEvent.setup();
    const saveMutate = vi.fn().mockResolvedValue(sampleDraft);
    mockUseSaveDraft.mockReturnValue({ isPending: false, mutateAsync: saveMutate });
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderPanel({ initialContent: "要覆盖保存的正文" });
    await user.click(screen.getByRole("button", { name: "覆盖槽位 1" }));
    expect(global.confirm).toHaveBeenCalledWith("确定要覆盖槽位 1 的正文草稿吗？");
    expect(saveMutate).toHaveBeenCalledWith({ content: "要覆盖保存的正文", slot: 1, version: 2 });
  });

  test("覆盖发生版本冲突时显示后端提示且不报告成功", async () => {
    const user = userEvent.setup();
    const saveMutate = vi.fn().mockRejectedValue(new Error("草稿已在其他位置修改，请刷新后重试"));
    mockUseSaveDraft.mockReturnValue({ isPending: false, mutateAsync: saveMutate });
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderPanel({ initialContent: "本地旧版本" });

    await user.click(screen.getByRole("button", { name: "覆盖槽位 1" }));

    expect(toast.error).toHaveBeenCalledWith("草稿已在其他位置修改，请刷新后重试");
    expect(toast.success).not.toHaveBeenCalled();
  });

  test("开启自动保存前确认槽位 1 将被接管", async () => {
    const user = userEvent.setup();
    const onAutoSaveChange = vi.fn();
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderPanel({ onAutoSaveChange });
    await user.click(screen.getByRole("switch", { name: "槽位 1 自动保存" }));
    expect(global.confirm).toHaveBeenCalledWith(
      "开启自动保存后，槽位 1 将由当前编辑器持续覆盖，是否继续？",
    );
    expect(onAutoSaveChange).toHaveBeenCalledWith(true, 2);
  });

  test("显示自动保存完成状态", () => {
    renderPanel({ autoSaveEnabled: true, autoSaveStatus: "saved" });
    expect(screen.getByText("当前内容已自动保存")).toBeInTheDocument();
  });

  test("恢复草稿覆盖当前正文前要求确认，取消时不恢复", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    vi.stubGlobal("confirm", vi.fn(() => false));
    renderPanel({ initialContent: "尚未保存的当前正文", onRestore });
    await user.click(screen.getByText("恢复"));
    expect(global.confirm).toHaveBeenCalledWith(
      "恢复草稿将覆盖当前编辑器内容，是否继续？",
    );
    expect(onRestore).not.toHaveBeenCalled();
  });
});
