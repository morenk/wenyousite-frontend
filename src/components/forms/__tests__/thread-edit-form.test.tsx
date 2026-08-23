/** ThreadEditForm 组件测试：桌面设置、权限边界与冲突恢复。 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadEditForm } from "@/components/forms/thread-edit-form";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { mockRouterReplace } = vi.hoisted(() => ({ mockRouterReplace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
}));

vi.mock("@/components/editor/milkdown-editor", () => ({
  MilkdownEditor: ({ defaultValue, onChange }: { defaultValue?: string; onChange?: (value: string) => void }) => (
    <textarea
      data-testid="milkdown-editor"
      defaultValue={defaultValue}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("@/components/forms/tag-input", () => ({
  TagInput: ({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) => (
    <div data-testid="tag-input">
      {value.map((tag) => <span key={tag}>{tag}</span>)}
      <button type="button" onClick={() => onChange(["保留", "新标签"])}>设置标签</button>
    </div>
  ),
}));

const {
  mockSaveThreadMutate,
  mockUploadImageMutate,
  mockCreateInviteMutate,
  mockDeleteThreadMutate,
} = vi.hoisted(() => ({
  mockSaveThreadMutate: vi.fn(),
  mockUploadImageMutate: vi.fn(),
  mockCreateInviteMutate: vi.fn(),
  mockDeleteThreadMutate: vi.fn(),
}));

vi.mock("@/api/hooks/use-save-thread-aggregate", () => ({
  useSaveThreadAggregate: () => ({ mutateAsync: mockSaveThreadMutate }),
}));
vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({ mutateAsync: mockUploadImageMutate, isPending: false }),
}));
vi.mock("@/api/hooks/use-thread-access-actions", () => ({
  useCreateInviteLink: () => ({ mutateAsync: mockCreateInviteMutate, isPending: false }),
}));
vi.mock("@/api/hooks/use-delete-thread", () => ({
  useDeleteThread: () => ({ mutateAsync: mockDeleteThreadMutate, isPending: false }),
}));

import { toast } from "sonner";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

function makeThread(visibility: ThreadDetail["visibility"] = "PUBLIC"): ThreadDetail {
  const defaultSubthread = {
    id: "s1",
    threadId: "t1",
    title: "测试帖",
    sortOrder: 0,
    postingPolicy: "PARTICIPANTS" as const,
    postingCapability: { canPost: true, denialReason: null },
    version: 1,
    lastPostAt: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: { id: "p1", content: "默认正文", version: 2, diceRolls: [] },
    _count: { posts: 1 },
  };
  return {
    id: "t1",
    title: "测试帖",
    ownerId: "u1",
    category: "RPG",
    categoryInfo: { slug: "RPG", name: "角色扮演", isActive: true },
    status: "RECRUITING",
    visibility,
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
    subthreads: [defaultSubthread],
    defaultSubthread,
    topicTags: [{
      id: "relation-1",
      threadId: "t1",
      tagId: "tag-1",
      tag: { id: "tag-1", name: "保留", color: null, description: null, sortOrder: 10, isActive: true },
    }],
    _count: { members: 1, players: 1, posts: 1 },
    isBookmarked: false,
    bookmarkId: null,
    isLiked: false,
  };
}

function savedThreadFromBody(thread: ThreadDetail, body: Record<string, unknown>): ThreadDetail {
  const bodyPost = {
    ...thread.defaultSubthread.bodyPost!,
    content: String(body.content ?? ""),
    version: 3,
  };
  const defaultSubthread = {
    ...thread.defaultSubthread,
    title: String(body.title ?? thread.defaultSubthread.title),
    version: 2,
    bodyPost,
  };
  return {
    ...thread,
    title: String(body.title ?? thread.title),
    category: (body.category as string | undefined) ?? thread.category,
    status: (body.status as ThreadDetail["status"]) ?? thread.status,
    visibility: (body.visibility as ThreadDetail["visibility"]) ?? thread.visibility,
    version: 4,
    defaultSubthread,
    subthreads: [defaultSubthread],
    topicTags: ((body.tagNames as string[]) ?? []).map((name) => ({
      id: `relation-${name}`,
      threadId: thread.id,
      tagId: `tag-${name}`,
      tag: { id: `tag-${name}`, name, color: null, description: null, sortOrder: 0, isActive: true },
    })),
  };
}

function renderForm({
  isOwner = true,
  thread = makeThread(),
  onReloadLatest = vi.fn().mockResolvedValue(thread),
}: {
  isOwner?: boolean;
  thread?: ThreadDetail;
  onReloadLatest?: () => Promise<ThreadDetail | undefined>;
} = {}) {
  const onStatusChange = vi.fn();
  render(
    <>
      <ThreadEditForm
        thread={thread}
        isOwner={isOwner}
        formId="test-thread-form"
        onStatusChange={onStatusChange}
        onReloadLatest={onReloadLatest}
      />
      <button type="submit" form="test-thread-form">保存帖子</button>
    </>,
    { wrapper: createWrapper() },
  );
  return { onStatusChange, onReloadLatest };
}

describe("ThreadEditForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    mockCreateInviteMutate.mockResolvedValue({ token: "invite-token" });
    mockDeleteThreadMutate.mockResolvedValue({});
    mockSaveThreadMutate.mockImplementation(
      async ({ body }: { body: Record<string, unknown> }) => savedThreadFromBody(makeThread(), body),
    );
  });

  test("使用内容主栏和发布侧栏回填现有数据", () => {
    renderForm();

    expect(screen.getByRole("heading", { name: "标题与主帖正文" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "发布设置" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("测试帖")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "可见性" })).toHaveTextContent("公开");
    expect(screen.getByDisplayValue("默认正文")).toBeInTheDocument();
  });

  test("保存标题、标签和正文并上报已保存状态", async () => {
    const user = userEvent.setup();
    const { onStatusChange } = renderForm();

    await user.clear(screen.getByTestId("milkdown-editor"));
    await user.type(screen.getByTestId("milkdown-editor"), "新正文");
    await user.clear(screen.getByLabelText("主题帖标题"));
    await user.type(screen.getByLabelText("主题帖标题"), "新标题");
    await user.click(screen.getByText("设置标签"));

    await vi.waitFor(() => {
      expect(onStatusChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ state: "dirty", dirty: true }),
      );
    });
    await user.click(screen.getByRole("button", { name: "保存帖子" }));

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
    expect(toast.success).toHaveBeenCalledWith("帖子修改已保存");
    await vi.waitFor(() => {
      expect(onStatusChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ state: "saved", dirty: false }),
      );
    });
  });

  test("协作者看到只读可见性和能力说明，保存请求不包含 visibility", async () => {
    const user = userEvent.setup();
    renderForm({ isOwner: false });

    expect(screen.getByRole("combobox", { name: "可见性" })).toBeDisabled();
    expect(screen.getByText("你正以协作者身份管理")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("主题帖标题"));
    await user.type(screen.getByLabelText("主题帖标题"), "协作者修改");
    await user.click(screen.getByRole("button", { name: "保存帖子" }));

    expect(mockSaveThreadMutate).toHaveBeenCalledWith({
      threadId: "t1",
      body: expect.not.objectContaining({ visibility: expect.anything() }),
    });
  });

  test("乐观锁冲突保留正文并提供复制与重新载入", async () => {
    const user = userEvent.setup();
    const onReloadLatest = vi.fn().mockResolvedValue(makeThread());
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    mockSaveThreadMutate.mockRejectedValueOnce({ code: 40002, message: "内容已被修改" });
    renderForm({ onReloadLatest });

    await user.type(screen.getByTestId("milkdown-editor"), "本地修改");
    await user.click(screen.getByRole("button", { name: "保存帖子" }));

    expect(await screen.findByText("检测到内容版本冲突")).toBeInTheDocument();
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("默认正文本地修改");
    await user.click(screen.getByRole("button", { name: "复制本地正文" }));
    expect(writeText).toHaveBeenCalledWith("默认正文本地修改");
    await user.click(screen.getByRole("button", { name: "载入最新版本" }));
    expect(onReloadLatest).toHaveBeenCalledTimes(1);
  });

  test("私密帖生成新邀请链接前确认并复制", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderForm({ thread: makeThread("PRIVATE") });

    await user.click(screen.getByRole("button", { name: "生成并复制邀请链接" }));

    expect(window.confirm).toHaveBeenCalledWith("生成后旧邀请链接会立即失效。确定继续吗？");
    expect(mockCreateInviteMutate).toHaveBeenCalledWith("t1");
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/join/invite-token"));
  });

  test("楼主可在危险区域删除主题帖并替换到首页", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "删除主题帖" }));

    expect(mockDeleteThreadMutate).toHaveBeenCalledWith("t1");
    expect(mockRouterReplace).toHaveBeenCalledWith("/");
  });

  test("标题超过上限时显示字段错误且不提交", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText("主题帖标题"));
    await user.type(screen.getByLabelText("主题帖标题"), "超".repeat(101));
    await user.click(screen.getByRole("button", { name: "保存帖子" }));

    expect(await screen.findByText("标题最多 100 个字符")).toBeInTheDocument();
    expect(mockSaveThreadMutate).not.toHaveBeenCalled();
  });
});
