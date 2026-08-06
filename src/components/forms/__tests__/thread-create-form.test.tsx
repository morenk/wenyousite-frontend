/** ThreadCreateForm 组件测试 — 简洁模式 */

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

vi.mock("@/components/forms/tag-input", () => ({
  TagInput: ({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) => (
    <div data-testid="tag-input">
      {value.map((tag) => <span key={tag}>{tag}</span>)}
      <button type="button" onClick={() => onChange(["剧情", "招募"])}>
        设置标签
      </button>
    </div>
  ),
}));

const {
  mockSaveThreadMutate,
  mockUploadImageMutate,
} =
  vi.hoisted(() => ({
    mockSaveThreadMutate: vi.fn(),
    mockUploadImageMutate: vi.fn(),
  }));

vi.mock("@/api/hooks/use-save-thread-aggregate", () => ({
  useSaveThreadAggregate: () => ({
    mutateAsync: mockSaveThreadMutate,
  }),
}));

vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({
    mutateAsync: mockUploadImageMutate,
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

function makeSub(id: string, title: string, sortOrder: number) {
  return {
    id,
    threadId: "t1",
    title,
    sortOrder,
    postingPolicy: "PARTICIPANTS" as const,
    version: 1,
    lastPostAt: null,
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
  subthreads: [makeSub("s1", "主帖", 0)],
  defaultSubthread: makeSub("s1", "主帖", 0),
  topicTags: [],
  _count: { members: 1, players: 1, posts: 0 },
  isBookmarked: false,
  bookmarkId: null,
  isLiked: false,
};

function renderForm(thread: ThreadDetail = mockThread) {
  mockSaveThreadMutate.mockResolvedValue(thread);
  return render(
    <ThreadCreateForm
      thread={thread}
      onCancel={vi.fn()}
      onPublished={vi.fn()}
    />,
    { wrapper: createWrapper() },
  );
}

describe("ThreadCreateForm", () => {
  test("渲染标题输入框", () => {
    renderForm();
    expect(screen.getByPlaceholderText("给你的主题帖起个名字")).toBeInTheDocument();
  });

  test("渲染分区选择", () => {
    renderForm();
    expect(screen.getByLabelText("分区")).toBeInTheDocument();
  });

  test("渲染可见性选择", () => {
    renderForm();
    expect(screen.getByLabelText("可见性")).toBeInTheDocument();
  });

  test("渲染标签输入", () => {
    renderForm();
    expect(screen.getByText("标签")).toBeInTheDocument();
  });

  test("保存草稿时同步所选标签", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "设置标签" }));
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    await vi.waitFor(() => {
      expect(mockSaveThreadMutate).toHaveBeenCalledWith({
        threadId: "t1",
        body: expect.objectContaining({ tagNames: ["剧情", "招募"] }),
      });
    });
  });

  test("渲染默认子贴正文编辑器", () => {
    renderForm();
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
  });

  test("渲染保存草稿/发布/放弃按钮", () => {
    renderForm();
    expect(screen.getByText("保存草稿")).toBeInTheDocument();
    expect(screen.getByText("发布")).toBeInTheDocument();
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
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByText("放弃"));
    expect(onCancel).toHaveBeenCalled();
  });

  test("继续编辑已有草稿时显示返回草稿列表", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <ThreadCreateForm
        thread={mockThread}
        cancelMode="back"
        onCancel={onCancel}
        onPublished={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("button", { name: "返回草稿列表" }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.queryByText("放弃")).not.toBeInTheDocument();
  });

  test("已命名草稿时标题回填", () => {
    const namedThread = { ...mockThread, title: "我的帖子" };
    renderForm(namedThread);
    expect(screen.getByDisplayValue("我的帖子")).toBeInTheDocument();
  });

  test("点击发布但标题为空时不调用更新", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText("发布"));
    expect(mockSaveThreadMutate).not.toHaveBeenCalled();
  });

  test("标题超过上限时阻止保存并显示字段错误", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByPlaceholderText("给你的主题帖起个名字"),
      "超".repeat(101),
    );
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(await screen.findByText("标题最多 100 个字符")).toBeInTheDocument();
    expect(mockSaveThreadMutate).not.toHaveBeenCalled();
  });

  test("标题已填但默认子贴无正文时提示校验错误", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("给你的主题帖起个名字"), "测试标题");
    await user.click(screen.getByText("发布"));

    expect(mockSaveThreadMutate).not.toHaveBeenCalled();
  });

  test("编辑正文后以单次聚合请求保存草稿", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByTestId("milkdown-editor"), "正文内容");
    await user.click(screen.getByText("保存草稿"));

    await vi.waitFor(() => {
      expect(mockSaveThreadMutate).toHaveBeenCalledWith({
        threadId: "t1",
        body: expect.objectContaining({
          content: "正文内容",
          version: 1,
          defaultSubthreadVersion: 1,
          bodyVersion: undefined,
        }),
      });
    });
  });

  test("标题变更与默认子贴标题在同一聚合请求中保存", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByPlaceholderText("给你的主题帖起个名字"),
      "新标题",
    );
    await user.click(screen.getByText("保存草稿"));

    await vi.waitFor(() => {
      expect(mockSaveThreadMutate).toHaveBeenCalledWith({
        threadId: "t1",
        body: expect.objectContaining({
          title: "新标题",
          defaultSubthreadVersion: 1,
        }),
      });
    });
  });

  test("标题为空时保存草稿不覆盖现有占位标题", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText("保存草稿"));

    expect(mockSaveThreadMutate).toHaveBeenCalledWith({
      threadId: "t1",
      body: expect.not.objectContaining({ title: expect.anything() }),
    });
  });
});
