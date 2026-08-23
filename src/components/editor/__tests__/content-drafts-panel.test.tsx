import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  drafts: vi.fn(),
  slots: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/api/hooks/use-content-drafts", () => ({ useContentDrafts: mocks.drafts }));
vi.mock("@/api/hooks/use-draft-slots", () => ({ useDraftSlots: mocks.slots }));
vi.mock("@/api/hooks/use-save-draft", () => ({ useSaveDraft: mocks.save }));
vi.mock("@/api/hooks/use-delete-content-draft", () => ({ useDeleteContentDraft: mocks.remove }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ContentDraftsPanel } from "@/components/editor/content-drafts-panel";

const draft = {
  id: "draft-1",
  userId: "user-1",
  slot: 1,
  content: "槽位正文",
  version: 2,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function mutation(mutateAsync = vi.fn().mockResolvedValue(draft)) {
  return { isPending: false, mutateAsync };
}

function renderPanel(props: Partial<React.ComponentProps<typeof ContentDraftsPanel>> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ContentDraftsPanel open onClose={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

describe("ContentDraftsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.drafts.mockReturnValue({
      data: [draft],
      isLoading: false,
      error: undefined,
      refetch: vi.fn().mockResolvedValue({ data: [draft] }),
    });
    mocks.slots.mockReturnValue({ data: { usedSlots: 1, maxSlots: 5, slots: [1] } });
    mocks.save.mockReturnValue(mutation());
    mocks.remove.mockReturnValue(mutation(vi.fn().mockResolvedValue({ message: "草稿已删除" })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("渲染五个槽位并恢复完整正文", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const onClose = vi.fn();
    renderPanel({ onRestore, onClose });
    expect(screen.getByRole("region", { name: "正文草稿" })).toHaveTextContent("已用 1/5");
    expect(screen.getAllByText("空闲槽位")).toHaveLength(4);
    await user.click(screen.getByText("恢复"));
    expect(onRestore).toHaveBeenCalledWith({ content: draft.content });
    expect(onClose).toHaveBeenCalled();
  });

  it("把当前正文保存到空槽位并原样保留空白", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue({ ...draft, slot: 2 });
    mocks.save.mockReturnValue(mutation(save));
    renderPanel({ initialContent: "  正文\n\n<br />\n" });
    await user.click(screen.getAllByText("保存当前正文")[0]!);
    expect(save).toHaveBeenCalledWith({ content: "  正文\n\n<br />\n", slot: 2 });
  });

  it("覆盖、删除和自动保存接管都要求确认", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue({ ...draft, version: 3 });
    const remove = vi.fn().mockResolvedValue({ message: "草稿已删除" });
    const onAutoSaveChange = vi.fn();
    mocks.save.mockReturnValue(mutation(save));
    mocks.remove.mockReturnValue(mutation(remove));
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderPanel({ initialContent: "新正文", onAutoSaveChange });

    await user.click(screen.getByRole("button", { name: "覆盖槽位 1" }));
    await user.click(screen.getByRole("button", { name: "删除草稿" }));
    await user.click(screen.getByRole("switch", { name: "槽位 1 自动保存" }));

    expect(save).toHaveBeenCalledWith({
      draftId: "draft-1",
      content: "新正文",
      version: 2,
    });
    expect(remove).toHaveBeenCalledWith({ id: "draft-1", version: 2 });
    expect(onAutoSaveChange).toHaveBeenCalledWith(true, {
      id: "draft-1",
      version: 2,
    });
  });

  it("覆盖非空正文时可取消恢复", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    vi.stubGlobal("confirm", vi.fn(() => false));
    renderPanel({ initialContent: "本地正文", onRestore });
    await user.click(screen.getByText("恢复"));
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("展示加载和错误恢复状态", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.drafts.mockReturnValue({ data: undefined, isLoading: false, error: new Error("offline"), refetch });
    const view = renderPanel();
    await user.click(screen.getByText("重试"));
    expect(refetch).toHaveBeenCalled();
    view.unmount();
    mocks.drafts.mockReturnValue({ data: undefined, isLoading: true, error: undefined, refetch });
    renderPanel();
    expect(screen.getByText("正文草稿")).toBeInTheDocument();
  });
});
