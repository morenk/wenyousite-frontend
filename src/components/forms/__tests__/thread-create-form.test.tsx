/** ThreadCreateForm 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadCreateForm } from "@/components/forms/thread-create-form";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";

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
} =
  vi.hoisted(() => ({
    mockUpdateThreadMutate: vi.fn(),
    mockCreatePostMutate: vi.fn(),
    mockUpdatePostMutate: vi.fn(),
    mockUploadImageMutate: vi.fn(),
    mockCreateSubthreadMutate: vi.fn(),
    mockUpdateSubthreadMutate: vi.fn(),
    mockDeleteSubthreadMutate: vi.fn(),
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
  subthreads: [
    {
      id: "s1",
      threadId: "t1",
      title: "主帖",
      sortOrder: 0,
      postingPolicy: "PARTICIPANTS" as const,
      version: 1,
      lastPostAt: null,
      bodyPostId: null,
      deletedAt: null,
      createdAt: "2026-01-01T00:00:00Z",
      bodyPost: null,
      _count: { posts: 0 },
      tags: [],
    },
  ],
  defaultSubthread: {
    id: "s1",
    threadId: "t1",
    title: "主帖",
    sortOrder: 0,
    postingPolicy: "PARTICIPANTS" as const,
    version: 1,
    lastPostAt: null,
    bodyPostId: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: null,
    _count: { posts: 0 },
    tags: [],
  },
  topicTags: [],
  _count: { members: 1, posts: 0 },
};

describe("ThreadCreateForm", () => {
  test("渲染标题输入框", () => {
    render(
      <ThreadCreateForm
        thread={mockThread}
        onCancel={vi.fn()}
        onPublished={vi.fn()}
        onRefetch={vi.fn().mockResolvedValue({ data: mockThread })}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByPlaceholderText("给你的主题帖起个名字")).toBeInTheDocument();
  });

  test("渲染子贴管理区域", () => {
    render(
      <ThreadCreateForm
        thread={mockThread}
        onCancel={vi.fn()}
        onPublished={vi.fn()}
        onRefetch={vi.fn().mockResolvedValue({ data: mockThread })}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("子贴管理")).toBeInTheDocument();
  });

  test("默认子贴展开时渲染编辑器", () => {
    render(
      <ThreadCreateForm
        thread={mockThread}
        onCancel={vi.fn()}
        onPublished={vi.fn()}
        onRefetch={vi.fn().mockResolvedValue({ data: mockThread })}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  test("渲染保存草稿按钮", () => {
    render(
      <ThreadCreateForm
        thread={mockThread}
        onCancel={vi.fn()}
        onPublished={vi.fn()}
        onRefetch={vi.fn().mockResolvedValue({ data: mockThread })}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("保存草稿")).toBeInTheDocument();
  });

  test("渲染发布按钮", () => {
    render(
      <ThreadCreateForm
        thread={mockThread}
        onCancel={vi.fn()}
        onPublished={vi.fn()}
        onRefetch={vi.fn().mockResolvedValue({ data: mockThread })}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("发布")).toBeInTheDocument();
  });

  test("渲染放弃按钮", () => {
    render(
      <ThreadCreateForm
        thread={mockThread}
        onCancel={vi.fn()}
        onPublished={vi.fn()}
        onRefetch={vi.fn().mockResolvedValue({ data: mockThread })}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("放弃")).toBeInTheDocument();
  });

  test("点击发布但标题为空时显示 toast 校验错误", async () => {
    const user = userEvent.setup();
    render(
      <ThreadCreateForm
        thread={mockThread}
        onCancel={vi.fn()}
        onPublished={vi.fn()}
        onRefetch={vi.fn().mockResolvedValue({ data: mockThread })}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByText("发布"));

    expect(mockUpdateThreadMutate).not.toHaveBeenCalled();
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
