/** ManagementPanel 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { ManagementPanel } from "@/components/thread/management-panel";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/editor/milkdown-editor", () => ({
  MilkdownEditor: ({ defaultValue, onChange }: { defaultValue?: string; onChange?: (v: string) => void }) => (
    <textarea
      data-testid="milkdown-editor"
      defaultValue={defaultValue}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

vi.mock("@/components/thread/subthread-tree", () => ({
  SubthreadTree: ({
    subthreads,
    onSelect,
    onEdit,
    onDelete,
    onReorder,
    onCreate,
  }: {
    subthreads: Array<{ id: string }>;
    onSelect: (id: string) => void;
    onEdit: (s: unknown) => void;
    onDelete: (s: unknown) => void;
    onReorder: (ids: string[]) => void;
    onCreate: () => void;
  }) => (
    <div data-testid="subthread-tree">
      {subthreads.map((s) => (
        <div key={s.id}>
          <button type="button" onClick={() => onSelect(s.id)}>
            select-{s.id}
          </button>
          <button type="button" onClick={() => onEdit(s)}>
            edit-{s.id}
          </button>
          <button type="button" onClick={() => onDelete(s)}>
            delete-{s.id}
          </button>
        </div>
      ))}
      <button type="button" onClick={onCreate}>
        mock-add-subthread
      </button>
      <button type="button" onClick={() => onReorder(["s2", "s1"])}>
        mock-reorder
      </button>
    </div>
  ),
}));

const {
  mockCreateSubthreadMutate,
  mockUpdateSubthreadMutate,
  mockDeleteSubthreadMutate,
  mockReorderSubthreadsMutate,
  mockCreatePostMutate,
  mockUpdatePostMutate,
  mockUploadImageMutate,
} = vi.hoisted(() => ({
  mockCreateSubthreadMutate: vi.fn(),
  mockUpdateSubthreadMutate: vi.fn(),
  mockDeleteSubthreadMutate: vi.fn(),
  mockReorderSubthreadsMutate: vi.fn(),
  mockCreatePostMutate: vi.fn(),
  mockUpdatePostMutate: vi.fn(),
  mockUploadImageMutate: vi.fn(),
}));

vi.mock("@/api/hooks/use-create-subthread", () => ({
  useCreateSubthread: () => ({ mutateAsync: mockCreateSubthreadMutate }),
}));
vi.mock("@/api/hooks/use-update-subthread", () => ({
  useUpdateSubthread: () => ({ mutateAsync: mockUpdateSubthreadMutate }),
}));
vi.mock("@/api/hooks/use-delete-subthread", () => ({
  useDeleteSubthread: () => ({ mutateAsync: mockDeleteSubthreadMutate }),
}));
vi.mock("@/api/hooks/use-reorder-subthreads", () => ({
  useReorderSubthreads: () => ({ mutateAsync: mockReorderSubthreadsMutate }),
}));
vi.mock("@/api/hooks/use-create-post", () => ({
  useCreatePost: () => ({ mutateAsync: mockCreatePostMutate }),
}));
vi.mock("@/api/hooks/use-update-post", () => ({
  useUpdatePost: () => ({ mutateAsync: mockUpdatePostMutate }),
}));
vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({ mutateAsync: mockUploadImageMutate }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

function makeSub(
  id: string,
  title: string,
  bodyPost: { id: string; content: string; version: number } | null,
) {
  return {
    id,
    threadId: "t1",
    title,
    sortOrder: id === "s1" ? 0 : 1,
    postingPolicy: "PARTICIPANTS" as const,
    version: 1,
    lastPostAt: null,
    bodyPostId: bodyPost?.id ?? null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost,
    _count: { posts: bodyPost ? 1 : 0 },
    tags: [],
  };
}

const mockThread: ThreadDetail = {
  id: "t1",
  title: "测试帖",
  ownerId: "u1",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  publishedAt: "2026-01-01T00:00:00Z",
  pinned: false,
  pinnedAt: null,
  viewCount: 0,
  version: 3,
  likeCount: 0,
  defaultSubthreadId: "s1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "test", avatar: null },
  subthreads: [
    makeSub("s1", "主帖", { id: "p1", content: "默认正文", version: 2 }),
    makeSub("s2", "设定区", null),
  ],
  defaultSubthread: makeSub("s1", "主帖", { id: "p1", content: "默认正文", version: 2 }),
  topicTags: [],
  _count: { members: 1, players: 1, posts: 1 },
};

function renderPanel(thread: ThreadDetail = mockThread) {
  return render(
    <ManagementPanel
      thread={thread}
      onExit={vi.fn()}
      onRefetch={vi.fn().mockResolvedValue({ data: thread })}
    />,
    { wrapper: createWrapper() },
  );
}

describe("ManagementPanel", () => {
  test("渲染返回浏览按钮与帖子标题", () => {
    renderPanel();
    expect(screen.getByText("返回浏览")).toBeInTheDocument();
    expect(screen.getByText("管理帖子：测试帖")).toBeInTheDocument();
  });

  test("默认选中默认子贴并回填正文", () => {
    renderPanel();
    expect(screen.getByText("正在编辑：主帖")).toBeInTheDocument();
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("默认正文");
  });

  test("切换子贴加载对应正文", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("select-s2"));

    expect(screen.getByText("正在编辑：设定区")).toBeInTheDocument();
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("");
  });

  test("已有正文时保存调用 updatePost", async () => {
    const user = userEvent.setup();
    renderPanel();

    const editor = screen.getByTestId("milkdown-editor");
    await user.clear(editor);
    await user.type(editor, "更新后的正文");
    await user.click(screen.getByText("保存修改"));

    await vi.waitFor(() => {
      expect(mockUpdatePostMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "p1",
          content: "更新后的正文",
          version: 2,
        }),
      );
    });
  });

  test("无正文子贴保存时调用 createPost", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("select-s2"));
    const editor = screen.getByTestId("milkdown-editor");
    await user.type(editor, "设定区首楼");
    await user.click(screen.getByText("保存修改"));

    await vi.waitFor(() => {
      expect(mockCreatePostMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          subthreadId: "s2",
          content: "设定区首楼",
        }),
      );
    });
  });

  test("点击添加子贴打开表单并提交调用 createSubthread", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("mock-add-subthread"));
    const input = screen.getByPlaceholderText("主帖 / 设定区 / 剧情区");
    await user.type(input, "新子贴");
    await user.click(screen.getByRole("button", { name: "添加" }));

    await vi.waitFor(() => {
      expect(mockCreateSubthreadMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: "t1",
          body: expect.objectContaining({ title: "新子贴" }),
        }),
      );
    });
  });

  test("点击编辑子贴打开表单回填默认值", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("edit-s2"));

    expect(screen.getByDisplayValue("设定区")).toBeInTheDocument();
    expect(screen.getByText("编辑子贴")).toBeInTheDocument();
  });

  test("删除子贴确认后调用 deleteSubthread", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("delete-s2"));

    await vi.waitFor(() => {
      expect(mockDeleteSubthreadMutate).toHaveBeenCalledWith("s2");
    });
  });

  test("取消删除确认时不调用 deleteSubthread", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("delete-s2"));

    expect(mockDeleteSubthreadMutate).not.toHaveBeenCalled();
  });

  test("拖拽排序调用 reorderSubthreads", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("mock-reorder"));

    await vi.waitFor(() => {
      expect(mockReorderSubthreadsMutate).toHaveBeenCalledWith(
        expect.objectContaining({ threadId: "t1", ids: ["s2", "s1"] }),
      );
    });
  });

  test("后端拒绝主帖排序时显示友好提示", async () => {
    const user = userEvent.setup();
    mockReorderSubthreadsMutate.mockRejectedValueOnce({
      message: "默认子贴必须排在第一位",
    });
    renderPanel();

    await user.click(screen.getByText("mock-reorder"));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "主帖必须保持在第一位，不能与其他子帖交换顺序",
      );
    });
  });

  test("排序其他失败显示通用提示", async () => {
    const user = userEvent.setup();
    mockReorderSubthreadsMutate.mockRejectedValueOnce({
      message: "网络错误",
    });
    renderPanel();

    await user.click(screen.getByText("mock-reorder"));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("排序保存失败，请稍后重试");
    });
  });
});
