/** ThreadCreateForm 组件测试 — 多子贴 + 楼层管理集成 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadCreateForm } from "@/components/forms/thread-create-form";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import type { PostData } from "@/api/hooks/use-floors";

vi.mock("@/components/editor/milkdown-editor", () => ({
  MilkdownEditor: ({ defaultValue, onChange }: { defaultValue?: string; onChange?: (v: string) => void }) => (
    <textarea
      data-testid="milkdown-editor"
      defaultValue={defaultValue}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

const {
  mockUpdateThreadMutate,
  mockCreatePostMutate,
  mockUpdatePostMutate,
  mockUploadImageMutate,
  mockCreateSubthreadMutate,
  mockUpdateSubthreadMutate,
  mockDeleteSubthreadMutate,
  mockDeletePostMutate,
} =
  vi.hoisted(() => ({
    mockUpdateThreadMutate: vi.fn(),
    mockCreatePostMutate: vi.fn(),
    mockUpdatePostMutate: vi.fn(),
    mockUploadImageMutate: vi.fn(),
    mockCreateSubthreadMutate: vi.fn(),
    mockUpdateSubthreadMutate: vi.fn(),
    mockDeleteSubthreadMutate: vi.fn(),
    mockDeletePostMutate: vi.fn(),
  }));

const mockEditFloor: PostData = {
  id: "floor-2",
  threadId: "t1",
  subthreadId: "s2",
  authorId: "u1",
  floorNumber: 2,
  parentPostId: null,
  replyToPostId: null,
  content: "二楼内容",
  version: 3,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  author: { id: "u1", username: "me", avatar: null },
  _count: { replies: 0 },
  replies: [],
};

vi.mock("@/components/thread/subthread-floors", () => ({
  SubthreadFloors: ({
    subthreadId,
    onAddFloor,
    onEditFloor,
    onDeleteFloor,
  }: {
    subthreadId: string;
    onAddFloor: () => void;
    onEditFloor: (f: PostData) => void;
    onDeleteFloor: (f: PostData) => void;
  }) => (
    <div data-testid={`subthread-floors-${subthreadId}`}>
      <button type="button" onClick={onAddFloor}>
        mock-添加楼层
      </button>
      <button type="button" onClick={() => onEditFloor(mockEditFloor)}>
        mock-编辑楼层
      </button>
      <button type="button" onClick={() => onDeleteFloor(mockEditFloor)}>
        mock-删除楼层
      </button>
    </div>
  ),
}));

vi.mock("@/api/hooks/use-update-thread", () => ({
  useUpdateThread: () => ({
    mutateAsync: mockUpdateThreadMutate,
    isLoading: false,
  }),
}));

vi.mock("@/api/hooks/use-create-post", () => ({
  useCreatePost: () => ({
    mutateAsync: mockCreatePostMutate,
    isLoading: false,
  }),
}));

vi.mock("@/api/hooks/use-update-post", () => ({
  useUpdatePost: () => ({
    mutateAsync: mockUpdatePostMutate,
    isLoading: false,
  }),
}));

vi.mock("@/api/hooks/use-delete-post", () => ({
  useDeletePost: () => ({
    mutateAsync: mockDeletePostMutate,
    isLoading: false,
  }),
}));

vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({
    mutateAsync: mockUploadImageMutate,
    isLoading: false,
  }),
}));

vi.mock("@/api/hooks/use-create-subthread", () => ({
  useCreateSubthread: () => ({
    mutateAsync: mockCreateSubthreadMutate,
    isLoading: false,
  }),
}));

vi.mock("@/api/hooks/use-update-subthread", () => ({
  useUpdateSubthread: () => ({
    mutateAsync: mockUpdateSubthreadMutate,
    isLoading: false,
  }),
}));

vi.mock("@/api/hooks/use-delete-subthread", () => ({
  useDeleteSubthread: () => ({
    mutateAsync: mockDeleteSubthreadMutate,
    isLoading: false,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
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

function makeSub(id: string, title: string, sortOrder: number) {
  return {
    id,
    threadId: "t1",
    title,
    sortOrder,
    postingPolicy: "PARTICIPANTS" as const,
    version: 1,
    lastPostAt: null,
    bodyPostId: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: null,
    _count: { posts: 0 },
    tags: [],
  };
}

const mockThread: ThreadDetail = {
  id: "t1",
  title: "未命名草稿",
  ownerId: "u1",
  category: "DEDUCTION",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: false,
  publishedAt: null,
  pinned: false,
  pinnedAt: null,
  viewCount: 0,
  version: 1,
  likeCount: 0,
  defaultSubthreadId: "s1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "test", avatar: null },
  subthreads: [makeSub("s1", "主帖", 0), makeSub("s2", "设定区", 1)],
  defaultSubthread: makeSub("s1", "主帖", 0),
  topicTags: [],
  _count: { members: 1, posts: 0 },
};

function renderForm() {
  return render(
    <ThreadCreateForm
      thread={mockThread}
      onCancel={vi.fn()}
      onPublished={vi.fn()}
      onRefetch={vi.fn().mockResolvedValue({ data: mockThread })}
    />,
    { wrapper: createWrapper() },
  );
}

describe("ThreadCreateForm 基础渲染", () => {
  test("渲染标题输入框", () => {
    renderForm();
    expect(screen.getByPlaceholderText("给你的主题帖起个名字")).toBeInTheDocument();
  });

  test("渲染子贴管理区域", () => {
    renderForm();
    expect(screen.getByText("子贴管理")).toBeInTheDocument();
  });

  test("默认子贴展开时渲染编辑器", () => {
    renderForm();
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  test("渲染保存草稿按钮", () => {
    renderForm();
    expect(screen.getByText("保存草稿")).toBeInTheDocument();
  });

  test("渲染发布按钮", () => {
    renderForm();
    expect(screen.getByText("发布")).toBeInTheDocument();
  });

  test("渲染放弃按钮", () => {
    renderForm();
    expect(screen.getByText("放弃")).toBeInTheDocument();
  });

  test("点击放弃调用 onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <ThreadCreateForm
        thread={mockThread}
        onCancel={onCancel}
        onPublished={vi.fn()}
        onRefetch={vi.fn().mockResolvedValue({ data: mockThread })}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByText("放弃"));
    expect(onCancel).toHaveBeenCalled();
  });

  test("已命名草稿时标题回填非'未命名草稿'的值", () => {
    const namedThread = { ...mockThread, title: "我的帖子" };
    render(
      <ThreadCreateForm
        thread={namedThread}
        onCancel={vi.fn()}
        onPublished={vi.fn()}
        onRefetch={vi.fn().mockResolvedValue({ data: namedThread })}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByDisplayValue("我的帖子")).toBeInTheDocument();
  });
});

describe("ThreadCreateForm 发布校验", () => {
  test("点击发布但标题为空时不调用更新", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText("发布"));
    expect(mockUpdateThreadMutate).not.toHaveBeenCalled();
  });

  test("标题已填但默认子贴无正文时提示校验错误", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("给你的主题帖起个名字"), "测试标题");
    await user.click(screen.getByText("发布"));

    expect(mockUpdateThreadMutate).not.toHaveBeenCalled();
  });
});

describe("ThreadCreateForm 楼层管理", () => {
  test("编辑既有楼层时编辑器回填内容并调用 updatePost", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText("设定区"));
    const s2Floors = screen.getByTestId("subthread-floors-s2");
    await user.click(within(s2Floors).getByText("mock-编辑楼层"));

    expect(screen.getByTestId("milkdown-editor")).toHaveValue("二楼内容");

    await user.click(screen.getByText("保存修改"));

    await vi.waitFor(() => {
      expect(mockUpdatePostMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "floor-2",
          content: "二楼内容",
          version: 3,
        }),
      );
    });
  });

  test("添加新楼层时编辑器为空并调用 createPost", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText("设定区"));
    const s2Floors = screen.getByTestId("subthread-floors-s2");
    await user.click(within(s2Floors).getByText("mock-添加楼层"));

    const editor = screen.getByTestId("milkdown-editor");
    expect(editor).toHaveValue("");

    await user.type(editor, "新楼层内容");
    await user.click(screen.getByText("添加楼层"));

    await vi.waitFor(() => {
      expect(mockCreatePostMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          subthreadId: "s2",
          content: "新楼层内容",
        }),
      );
    });
  });

  test("楼层内容为空时保存提示错误且不调用 API", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText("设定区"));
    const s2Floors = screen.getByTestId("subthread-floors-s2");
    await user.click(within(s2Floors).getByText("mock-添加楼层"));

    await user.click(screen.getByText("添加楼层"));

    expect(mockCreatePostMutate).not.toHaveBeenCalled();
  });

  test("点击取消退出编辑模式", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();

    await user.click(screen.getByText("取消"));

    expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument();
    expect(screen.getByTestId("subthread-floors-s1")).toBeInTheDocument();
  });

  test("删除楼层时调用 deletePost", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText("设定区"));
    const s2Floors = screen.getByTestId("subthread-floors-s2");
    await user.click(within(s2Floors).getByText("mock-删除楼层"));

    await vi.waitFor(() => {
      expect(mockDeletePostMutate).toHaveBeenCalledWith("floor-2");
    });
  });

  test("取消删除确认时不调用 deletePost", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText("设定区"));
    const s2Floors = screen.getByTestId("subthread-floors-s2");
    await user.click(within(s2Floors).getByText("mock-删除楼层"));

    expect(mockDeletePostMutate).not.toHaveBeenCalled();
  });
});
