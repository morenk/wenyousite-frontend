/** ThreadEditForm 组件测试：已发布帖编辑保存 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadEditForm } from "@/components/forms/thread-edit-form";
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

vi.mock("@/components/forms/tag-input", () => ({
  TagInput: ({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) => (
    <div data-testid="tag-input">
      {value.map((t) => (
        <span key={t}>{t}</span>
      ))}
      <button type="button" onClick={() => onChange(["保留", "新标签"])}>
        设置标签
      </button>
    </div>
  ),
}));

const {
  mockSaveThreadMutate,
  mockUploadImageMutate,
} = vi.hoisted(() => ({
  mockSaveThreadMutate: vi.fn(),
  mockUploadImageMutate: vi.fn(),
}));

vi.mock("@/api/hooks/use-save-thread-aggregate", () => ({
  useSaveThreadAggregate: () => ({ mutateAsync: mockSaveThreadMutate }),
}));
vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({ mutateAsync: mockUploadImageMutate, isPending: false }),
}));

import { toast } from "sonner";

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
  tipTotal: "0",
  defaultSubthreadId: "s1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "test", avatar: null, level: 1 },
  subthreads: [
    {
      id: "s1",
      threadId: "t1",
      title: "测试帖",
      sortOrder: 0,
      postingPolicy: "PARTICIPANTS",
      version: 1,
      lastPostAt: null,
      deletedAt: null,
      createdAt: "2026-01-01T00:00:00Z",
      bodyPost: { id: "p1", content: "默认正文", version: 2, diceRolls: [] },
      _count: { posts: 1 },
    },
  ],
  defaultSubthread: {
    id: "s1",
    threadId: "t1",
    title: "测试帖",
    sortOrder: 0,
    postingPolicy: "PARTICIPANTS",
    version: 1,
    lastPostAt: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: { id: "p1", content: "默认正文", version: 2, diceRolls: [] },
    _count: { posts: 1 },
  },
  topicTags: [
    {
      id: "relation-1",
      threadId: "thread-1",
      tagId: "tag-1",
      tag: { id: "tag-1", name: "保留", color: null, description: null, sortOrder: 10, isActive: true },
    },
  ],
  _count: { members: 1, players: 1, posts: 1 },
  isBookmarked: false,
  bookmarkId: null,
  isLiked: false,
};

function renderForm(isOwner = true) {
  const onDirtyChange = vi.fn();
  const onSavingChange = vi.fn();
  render(
    <ThreadEditForm
      thread={mockThread}
      isOwner={isOwner}
      onDirtyChange={onDirtyChange}
      onSavingChange={onSavingChange}
    />,
    { wrapper: createWrapper() },
  );
  return { onDirtyChange, onSavingChange };
}

describe("ThreadEditForm", () => {
  beforeEach(() => {
    mockSaveThreadMutate.mockImplementation(
      async ({ body }: { body: Record<string, unknown> }) => {
        const nextBodyPost = {
          ...mockThread.defaultSubthread.bodyPost!,
          content: String(body.content ?? ""),
          version: 3,
        };
        const nextSubthread = {
          ...mockThread.defaultSubthread,
          title: String(body.title ?? mockThread.defaultSubthread.title),
          version: 2,
          bodyPost: nextBodyPost,
        };
        return {
          ...mockThread,
          title: String(body.title ?? mockThread.title),
          category: body.category ?? mockThread.category,
          status: body.status ?? mockThread.status,
          visibility: body.visibility ?? mockThread.visibility,
          version: 4,
          defaultSubthread: nextSubthread,
          subthreads: [nextSubthread],
          topicTags: ((body.tagNames as string[]) ?? []).map((name) => ({
            id: `relation-${name}`,
            threadId: mockThread.id,
            tagId: `tag-${name}`,
            tag: { id: `tag-${name}`, name, color: null },
          })),
        } as ThreadDetail;
      },
    );
  });

  test("回填现有标题、分区、可见性、标签、正文", () => {
    renderForm();
    expect(screen.getByDisplayValue("测试帖")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "分区" })).toHaveTextContent("RPG");
    expect(screen.getByRole("combobox", { name: "可见性" })).toHaveTextContent("公开");
    expect(screen.getByRole("combobox", { name: "状态" })).toHaveTextContent("招募中");
    expect(screen.getByText("保留")).toBeInTheDocument();
    expect(screen.getByDisplayValue("默认正文")).toBeInTheDocument();
  });

  test("保存修改：更新正文、标题和标签并停留在表单", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByTestId("milkdown-editor"));
    await user.type(screen.getByTestId("milkdown-editor"), "新正文");
    await user.clear(screen.getByLabelText("主题帖标题"));
    await user.type(screen.getByLabelText("主题帖标题"), "新标题");
    await user.click(screen.getByText("设置标签"));

    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(mockSaveThreadMutate).toHaveBeenCalledWith({
      threadId: "t1",
      body: {
        title: "新标题",
        status: "RECRUITING",
        visibility: "PUBLIC",
        version: 3,
        defaultSubthreadVersion: 1,
        bodyVersion: 2,
        content: "新正文",
        tagNames: ["保留", "新标签"],
      },
    });
    expect(toast.success).toHaveBeenCalledWith("修改已保存");
    expect(screen.getByRole("button", { name: "保存修改" })).toBeInTheDocument();
  });

  test("保存修改时保留正文首尾内容", async () => {
    const user = userEvent.setup();
    renderForm();
    const content = "  正文\n\n<br />\n";

    await user.clear(screen.getByTestId("milkdown-editor"));
    await user.type(screen.getByTestId("milkdown-editor"), content);
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(mockSaveThreadMutate).toHaveBeenCalledWith({
      threadId: "t1",
      body: expect.objectContaining({ content }),
    });
  });

  test("标题变化通过聚合端点同步默认子贴标题", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText("主题帖标题"));
    await user.type(screen.getByLabelText("主题帖标题"), "新标题");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(mockSaveThreadMutate).toHaveBeenCalledWith({
      threadId: "t1",
      body: expect.objectContaining({
        title: "新标题",
        defaultSubthreadVersion: 1,
      }),
    });
  });

  test("协作者不可修改可见性且保存请求不包含 visibility", async () => {
    const user = userEvent.setup();
    renderForm(false);

    expect(screen.queryByLabelText("可见性")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(mockSaveThreadMutate).toHaveBeenCalledWith({
      threadId: "t1",
      body: {
        title: "测试帖",
        status: "RECRUITING",
        version: 3,
        defaultSubthreadVersion: 1,
        bodyVersion: 2,
        content: "默认正文",
        tagNames: ["保留"],
      },
    });
  });

  test("协作者可以修改帖子状态", async () => {
    const user = userEvent.setup();
    renderForm(false);

    await user.click(screen.getByRole("combobox", { name: "状态" }));
    await user.click(await screen.findByRole("option", { name: "已结束" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(mockSaveThreadMutate).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ status: "FINISHED" }) }),
    );
  });

  test("乐观锁冲突提示 40002", async () => {
    const user = userEvent.setup();
    renderForm();
    mockSaveThreadMutate.mockRejectedValueOnce({ code: 40002, message: "内容已被修改" });

    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(toast.error).toHaveBeenCalledWith("内容已被修改，请刷新后重试");
    expect(toast.success).not.toHaveBeenCalled();
  });

  test("标题超过上限时阻止保存并显示字段错误", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText("主题帖标题"));
    await user.type(screen.getByLabelText("主题帖标题"), "超".repeat(101));
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(await screen.findByText("标题最多 100 个字符")).toBeInTheDocument();
    expect(mockSaveThreadMutate).not.toHaveBeenCalled();
  });

  test("修改后上报未保存状态，保存成功后清除", async () => {
    const user = userEvent.setup();
    const { onDirtyChange } = renderForm();

    await user.clear(screen.getByLabelText("主题帖标题"));
    await user.type(screen.getByLabelText("主题帖标题"), "新标题");
    await vi.waitFor(() => {
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    });

    await user.click(screen.getByRole("button", { name: "保存修改" }));

    await vi.waitFor(() => {
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });
  });

  test("管理容器统一提供返回入口，表单不再渲染返回按钮", () => {
    renderForm();

    expect(screen.queryByRole("button", { name: "返回" })).not.toBeInTheDocument();
  });
});
