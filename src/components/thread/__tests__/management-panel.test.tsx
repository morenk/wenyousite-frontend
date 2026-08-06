/** ManagementPanel 组件测试 */

import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ManagementPanel,
  type ManagementView,
} from "@/components/thread/management-panel";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/thread/member-manager", () => ({
  MemberManager: ({ isOwner }: { isOwner: boolean }) => (
    <div data-testid="member-manager">成员管理 isOwner={String(isOwner)}</div>
  ),
}));

vi.mock("@/components/forms/thread-edit-form", () => ({
  ThreadEditForm: ({
    isOwner,
    onDirtyChange,
  }: {
    isOwner: boolean;
    onDirtyChange?: (isDirty: boolean) => void;
  }) => (
    <div data-testid="thread-edit-form">
      主题帖编辑 isOwner={String(isOwner)}
      <button type="button" onClick={() => onDirtyChange?.(true)}>
        模拟修改主题帖
      </button>
    </div>
  ),
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

vi.mock("@/components/forms/tag-input", () => ({
  TagInput: ({
    value,
    onChange,
  }: {
    value: string[];
    onChange: (tags: string[]) => void;
  }) => (
    <div>
      <span data-testid="tag-values">{value.join(",")}</span>
      <button type="button" onClick={() => onChange([...value, "剧情"])}>
        添加测试标签
      </button>
    </div>
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
      <button type="button" onClick={() => onReorder(["s3", "s2"])}>
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
  mockUpsertBodyMutate,
  mockUploadImageMutate,
  mockSyncSubthreadTagsMutate,
} = vi.hoisted(() => ({
  mockCreateSubthreadMutate: vi.fn(),
  mockUpdateSubthreadMutate: vi.fn(),
  mockDeleteSubthreadMutate: vi.fn(),
  mockReorderSubthreadsMutate: vi.fn(),
  mockUpsertBodyMutate: vi.fn(),
  mockUploadImageMutate: vi.fn(),
  mockSyncSubthreadTagsMutate: vi.fn(),
}));

vi.mock("@/api/hooks/use-create-subthread", () => ({
  useCreateSubthread: () => ({
    mutateAsync: mockCreateSubthreadMutate,
    isPending: false,
  }),
}));
vi.mock("@/api/hooks/use-update-subthread", () => ({
  useUpdateSubthread: () => ({
    mutateAsync: mockUpdateSubthreadMutate,
    isPending: false,
  }),
}));
vi.mock("@/api/hooks/use-delete-subthread", () => ({
  useDeleteSubthread: () => ({ mutateAsync: mockDeleteSubthreadMutate }),
}));
vi.mock("@/api/hooks/use-reorder-subthreads", () => ({
  useReorderSubthreads: () => ({ mutateAsync: mockReorderSubthreadsMutate }),
}));
vi.mock("@/api/hooks/use-upsert-body", () => ({
  useUpsertBody: () => ({ mutateAsync: mockUpsertBodyMutate }),
}));
vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({ mutateAsync: mockUploadImageMutate, isPending: false }),
}));
vi.mock("@/api/hooks/use-sync-subthread-tags", () => ({
  useSyncSubthreadTags: () => ({
    mutateAsync: mockSyncSubthreadTagsMutate,
    isPending: false,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: "u1", username: "test" } });
  mockCreateSubthreadMutate.mockResolvedValue(
    makeSub("s3", "新子贴", null),
  );
  mockSyncSubthreadTagsMutate.mockResolvedValue(undefined);
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
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: bodyPost ? { ...bodyPost, diceRolls: [] } : null,
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
  isBookmarked: false,
  bookmarkId: null,
  isLiked: false,
};

function renderPanel(
  thread: ThreadDetail = mockThread,
  initialView: ManagementView = "subthreads",
) {
  const onExit = vi.fn();
  const result = render(
    <ManagementPanel
      thread={thread}
      initialView={initialView}
      onExit={onExit}
      onRefetch={vi.fn().mockResolvedValue({ data: thread })}
    />,
    { wrapper: createWrapper() },
  );
  return { ...result, onExit };
}

function renderDefaultPanel(thread: ThreadDetail = mockThread) {
  const onExit = vi.fn();
  const result = render(
    <ManagementPanel
      thread={thread}
      onExit={onExit}
      onRefetch={vi.fn().mockResolvedValue({ data: thread })}
    />,
    { wrapper: createWrapper() },
  );
  return { ...result, onExit };
}

describe("ManagementPanel", () => {
  test("渲染返回浏览按钮与帖子标题", () => {
    renderDefaultPanel();
    expect(screen.getByText("返回浏览")).toBeInTheDocument();
    expect(screen.getByText("管理帖子：测试帖")).toBeInTheDocument();
  });

  test("默认进入主题帖编辑页签", () => {
    renderDefaultPanel();

    expect(screen.getByTestId("thread-edit-form")).toBeInTheDocument();
    expect(screen.queryByText("子贴目录")).not.toBeInTheDocument();
  });

  test("子贴目录不展示主帖并默认编辑第一个真实子贴", () => {
    renderPanel();

    expect(screen.queryByText("select-s1")).not.toBeInTheDocument();
    expect(screen.queryByText("edit-s1")).not.toBeInTheDocument();
    expect(screen.queryByText("delete-s1")).not.toBeInTheDocument();
    expect(screen.getByText("正在编辑：设定区")).toBeInTheDocument();
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  test("非默认子贴渲染发帖权限中文标签", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("select-s2"));

    expect(screen.getByText("发帖权限：所有人")).toBeInTheDocument();
  });

  test("切换子贴加载对应正文", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("select-s2"));

    expect(screen.getByText("正在编辑：设定区")).toBeInTheDocument();
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("");
  });

  test("已有正文时保存调用 upsertBody 并传 version", async () => {
    const user = userEvent.setup();
    const thread = {
      ...mockThread,
      subthreads: [
        mockThread.subthreads[0],
        makeSub("s2", "设定区", {
          id: "p2",
          content: "设定正文",
          version: 4,
        }),
      ],
    };
    renderPanel(thread);

    await user.click(screen.getByText("select-s2"));
    const editor = screen.getByTestId("milkdown-editor");
    await user.clear(editor);
    await user.type(editor, "更新后的正文");
    await user.click(screen.getByText("保存修改"));

    await vi.waitFor(() => {
      expect(mockUpsertBodyMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          subthreadId: "s2",
          content: "更新后的正文",
          version: 4,
        }),
      );
    });
  });

  test("无正文子贴保存时调用 upsertBody 且 version 为 undefined", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("select-s2"));
    const editor = screen.getByTestId("milkdown-editor");
    await user.type(editor, "设定区首楼");
    await user.click(screen.getByText("保存修改"));

    await vi.waitFor(() => {
      expect(mockUpsertBodyMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          subthreadId: "s2",
          content: "设定区首楼",
          version: undefined,
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
    await user.click(screen.getByText("添加测试标签"));
    await user.click(screen.getByRole("button", { name: "添加" }));

    await vi.waitFor(() => {
      expect(mockCreateSubthreadMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: "t1",
          body: expect.objectContaining({ title: "新子贴" }),
        }),
      );
      expect(mockSyncSubthreadTagsMutate).toHaveBeenCalledWith({
        subthreadId: "s3",
        existingTags: [],
        targetNames: ["剧情"],
      });
    });
  });

  test("点击编辑子贴打开表单回填默认值", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("edit-s2"));

    expect(screen.getByDisplayValue("设定区")).toBeInTheDocument();
    expect(screen.getByText("编辑子贴")).toBeInTheDocument();
    expect(screen.getByTestId("tag-values")).toHaveTextContent("");
  });

  test("编辑子贴时按现有标签同步变更", async () => {
    const user = userEvent.setup();
    const taggedSub = {
      ...mockThread.subthreads[1],
      tags: [
        { tag: { id: "tag-existing", name: "设定", color: null } },
      ],
    };
    renderPanel({
      ...mockThread,
      subthreads: [mockThread.subthreads[0], taggedSub],
    });

    await user.click(screen.getByText("edit-s2"));
    expect(screen.getByTestId("tag-values")).toHaveTextContent("设定");
    await user.click(screen.getByText("添加测试标签"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await vi.waitFor(() => {
      expect(mockSyncSubthreadTagsMutate).toHaveBeenCalledWith({
        subthreadId: "s2",
        existingTags: [
          { id: "tag-existing", name: "设定", color: null },
        ],
        targetNames: ["设定", "剧情"],
      });
    });
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
        expect.objectContaining({
          threadId: "t1",
          ids: ["s1", "s3", "s2"],
        }),
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

  test("切换到成员 tab 显示成员管理", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "成员" }));

    expect(screen.getByTestId("member-manager")).toBeInTheDocument();
    expect(screen.getByText("成员管理 isOwner=true")).toBeInTheDocument();
  });

  test("主题帖有未保存修改时取消切换会停留在当前页签", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => false));
    renderDefaultPanel();

    await user.click(screen.getByRole("button", { name: "模拟修改主题帖" }));
    await user.click(screen.getByRole("button", { name: "子贴" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "当前修改尚未保存，确定要放弃吗？",
    );
    expect(screen.getByTestId("thread-edit-form")).toBeInTheDocument();
  });

  test("确认放弃主题帖修改后可切换页签", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    renderDefaultPanel();

    await user.click(screen.getByRole("button", { name: "模拟修改主题帖" }));
    await user.click(screen.getByRole("button", { name: "子贴" }));

    expect(screen.getByText("子贴目录")).toBeInTheDocument();
  });

  test("主题帖有未保存修改时返回浏览同样需要确认", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => false));
    const { onExit } = renderDefaultPanel();

    await user.click(screen.getByRole("button", { name: "模拟修改主题帖" }));
    await user.click(screen.getByRole("button", { name: "返回浏览" }));

    expect(onExit).not.toHaveBeenCalled();
  });

  test("非默认子贴有未保存正文时取消切换会保留编辑内容", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => false));
    renderPanel({
      ...mockThread,
      subthreads: [...mockThread.subthreads, makeSub("s3", "剧情区", null)],
    });

    await user.click(screen.getByText("select-s2"));
    await user.type(screen.getByTestId("milkdown-editor"), "尚未保存");
    await user.click(screen.getByText("select-s3"));

    expect(window.confirm).toHaveBeenCalledWith(
      "当前修改尚未保存，确定要放弃吗？",
    );
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("尚未保存");
  });

  test("非帖主查看成员 tab 时 isOwner 为 false", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "other" } });
    renderPanel();

    await user.click(screen.getByRole("button", { name: "成员" }));

    expect(screen.getByText("成员管理 isOwner=false")).toBeInTheDocument();
  });
});
