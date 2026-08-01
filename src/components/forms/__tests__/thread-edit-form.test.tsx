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
  mockUpdateThreadMutate,
  mockUpdateSubthreadMutate,
  mockUpsertBodyMutate,
  mockSyncTagsMutate,
  mockUploadImageMutate,
} = vi.hoisted(() => ({
  mockUpdateThreadMutate: vi.fn(),
  mockUpdateSubthreadMutate: vi.fn(),
  mockUpsertBodyMutate: vi.fn(),
  mockSyncTagsMutate: vi.fn(),
  mockUploadImageMutate: vi.fn(),
}));

vi.mock("@/api/hooks/use-update-thread", () => ({
  useUpdateThread: () => ({ mutateAsync: mockUpdateThreadMutate }),
}));
vi.mock("@/api/hooks/use-update-subthread", () => ({
  useUpdateSubthread: () => ({ mutateAsync: mockUpdateSubthreadMutate }),
}));
vi.mock("@/api/hooks/use-upsert-body", () => ({
  useUpsertBody: () => ({ mutateAsync: mockUpsertBodyMutate }),
}));
vi.mock("@/api/hooks/use-sync-thread-tags", () => ({
  useSyncThreadTags: () => ({ mutateAsync: mockSyncTagsMutate }),
}));
vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({ mutateAsync: mockUploadImageMutate }),
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
  defaultSubthreadId: "s1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "test", avatar: null },
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
      bodyPost: { id: "p1", content: "默认正文", version: 2 },
      _count: { posts: 1 },
      tags: [],
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
    bodyPost: { id: "p1", content: "默认正文", version: 2 },
    _count: { posts: 1 },
    tags: [],
  },
  topicTags: [{ tag: { id: "tag-1", name: "保留", color: null } }],
  _count: { members: 1, players: 1, posts: 1 },
};

function renderForm() {
  const onBack = vi.fn();
  const onSaved = vi.fn().mockResolvedValue({ data: mockThread });
  render(<ThreadEditForm thread={mockThread} onBack={onBack} onSaved={onSaved} />, {
    wrapper: createWrapper(),
  });
  return { onBack, onSaved };
}

describe("ThreadEditForm", () => {
  beforeEach(() => {
    mockUpdateThreadMutate.mockResolvedValue({ id: "t1" });
    mockUpdateSubthreadMutate.mockResolvedValue({});
    mockUpsertBodyMutate.mockResolvedValue({ id: "p1" });
    mockSyncTagsMutate.mockResolvedValue(undefined);
  });

  test("回填现有标题、分区、可见性、标签、正文", () => {
    renderForm();
    expect(screen.getByDisplayValue("测试帖")).toBeInTheDocument();
    const category = screen.getByLabelText("分区") as HTMLSelectElement;
    expect(category.value).toBe("RPG");
    const visibility = screen.getByLabelText("可见性") as HTMLSelectElement;
    expect(visibility.value).toBe("PUBLIC");
    expect(screen.getByText("保留")).toBeInTheDocument();
    expect(screen.getByDisplayValue("默认正文")).toBeInTheDocument();
  });

  test("保存修改：更新正文、标题、标签并回详情", async () => {
    const user = userEvent.setup();
    const { onBack, onSaved } = renderForm();

    await user.clear(screen.getByTestId("milkdown-editor"));
    await user.type(screen.getByTestId("milkdown-editor"), "新正文");
    await user.clear(screen.getByLabelText("主题帖标题"));
    await user.type(screen.getByLabelText("主题帖标题"), "新标题");
    await user.click(screen.getByText("设置标签"));

    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(mockUpsertBodyMutate).toHaveBeenCalledWith({
      subthreadId: "s1",
      content: "新正文",
      version: 2,
    });
    expect(mockSyncTagsMutate).toHaveBeenCalledWith({
      threadId: "t1",
      existingTags: [{ id: "tag-1", name: "保留", color: null }],
      targetNames: ["保留", "新标签"],
    });
    expect(mockUpdateThreadMutate).toHaveBeenCalledWith({
      threadId: "t1",
      body: {
        title: "新标题",
        category: "RPG",
        visibility: "PUBLIC",
        version: 3,
      },
    });
    expect(toast.success).toHaveBeenCalledWith("修改已保存");
    expect(onBack).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(2);
  });

  test("标题变化时同步默认子贴标题", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText("主题帖标题"));
    await user.type(screen.getByLabelText("主题帖标题"), "新标题");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(mockUpdateSubthreadMutate).toHaveBeenCalledWith({
      subthreadId: "s1",
      body: { title: "新标题", version: 1 },
    });
  });

  test("乐观锁冲突提示 40900", async () => {
    const user = userEvent.setup();
    renderForm();
    mockUpdateThreadMutate.mockRejectedValueOnce({ code: 40900, message: "内容已被修改" });

    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(toast.error).toHaveBeenCalledWith("内容已被修改，请刷新后重试");
    expect(toast.success).not.toHaveBeenCalled();
  });

  test("返回按钮不保存直接回详情", async () => {
    const user = userEvent.setup();
    const { onBack } = renderForm();

    await user.click(screen.getByRole("button", { name: "返回" }));

    expect(mockUpdateThreadMutate).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });
});
