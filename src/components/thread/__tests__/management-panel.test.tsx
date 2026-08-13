/** ManagementPanel 桌面工作台、URL 状态与保存保护测试。 */

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { toast } from "sonner";
import { ManagementPanel } from "@/components/thread/management-panel";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import type { ManagementEditorStatus } from "@/components/thread/management-types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  permissions: vi.fn(),
  settingsSubmit: vi.fn(),
  createSubthread: vi.fn(),
  updateSubthread: vi.fn(),
  deleteSubthread: vi.fn(),
  reorderSubthreads: vi.fn(),
  upsertBody: vi.fn(),
  uploadImage: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mocks.auth(),
}));

vi.mock("@/components/thread/thread-permissions-context", () => ({
  useThreadPermissions: () => mocks.permissions(),
}));

vi.mock("@/components/thread/member-manager", () => ({
  MemberManager: ({ isOwner, isCollaborator }: {
    isOwner: boolean;
    isCollaborator: boolean;
  }) => (
    <div data-testid="member-manager">
      成员权限 isOwner={String(isOwner)} isCollaborator={String(isCollaborator)}
    </div>
  ),
}));

vi.mock("@/components/forms/thread-edit-form", () => ({
  ThreadEditForm: ({
    isOwner,
    formId,
    onStatusChange,
  }: {
    isOwner: boolean;
    formId: string;
    onStatusChange: (status: ManagementEditorStatus) => void;
  }) => {
    useEffect(() => {
      onStatusChange({ state: "saved", dirty: false, busy: false });
    }, [onStatusChange]);

    return (
      <form
        id={formId}
        data-testid="thread-edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          mocks.settingsSubmit();
          onStatusChange({ state: "saved", dirty: false, busy: false });
        }}
      >
        帖子设置 isOwner={String(isOwner)}
        <button
          type="button"
          onClick={() => onStatusChange({ state: "dirty", dirty: true, busy: false })}
        >
          模拟修改帖子
        </button>
      </form>
    );
  },
}));

vi.mock("@/components/editor/milkdown-editor", () => ({
  MilkdownEditor: ({
    defaultValue,
    onChange,
    onUploadImage,
    autoFocus,
  }: {
    defaultValue?: string;
    onChange?: (value: string) => void;
    onUploadImage?: (file: File) => Promise<string>;
    autoFocus?: boolean;
  }) => (
    <div>
      <textarea
        data-testid="milkdown-editor"
        data-auto-focus={autoFocus ? "true" : "false"}
        defaultValue={defaultValue}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <button
        type="button"
        onClick={() => void onUploadImage?.(new File(["image"], "test.png"))}
      >
        mock-upload
      </button>
    </div>
  ),
}));

vi.mock("@/components/thread/subthread-tree", () => ({
  SubthreadTree: ({
    subthreads,
    selectedId,
    disabled,
    onSelect,
    onDelete,
    onReorder,
    onCreate,
  }: {
    subthreads: Array<{ id: string; title: string }>;
    selectedId?: string;
    disabled?: boolean;
    onSelect: (id: string) => void;
    onDelete: (subthread: { id: string; title: string }) => void;
    onReorder: (ids: string[]) => void;
    onCreate: () => void;
  }) => (
    <div data-testid="subthread-tree">
      {subthreads.map((subthread) => (
        <div key={subthread.id} data-selected={selectedId === subthread.id ? "true" : "false"}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(subthread.id)}
          >
            select-{subthread.id}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDelete(subthread)}
          >
            delete-{subthread.id}
          </button>
        </div>
      ))}
      <button type="button" disabled={disabled} onClick={onCreate}>mock-add-subthread</button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onReorder([...subthreads].reverse().map((item) => item.id))}
      >
        mock-reorder
      </button>
    </div>
  ),
}));

vi.mock("@/api/hooks/use-create-subthread", () => ({
  useCreateSubthread: () => ({ mutateAsync: mocks.createSubthread, isPending: false }),
}));
vi.mock("@/api/hooks/use-update-subthread", () => ({
  useUpdateSubthread: () => ({ mutateAsync: mocks.updateSubthread, isPending: false }),
}));
vi.mock("@/api/hooks/use-delete-subthread", () => ({
  useDeleteSubthread: () => ({ mutateAsync: mocks.deleteSubthread, isPending: false }),
}));
vi.mock("@/api/hooks/use-reorder-subthreads", () => ({
  useReorderSubthreads: () => ({ mutateAsync: mocks.reorderSubthreads, isPending: false }),
}));
vi.mock("@/api/hooks/use-upsert-body", () => ({
  useUpsertBody: () => ({ mutateAsync: mocks.upsertBody, isPending: false }),
}));
vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({ mutateAsync: mocks.uploadImage, isPending: false }),
}));

function makeSub(
  id: string,
  title: string,
  bodyPost: { id: string; content: string; version: number } | null,
  sortOrder = 1,
) {
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
    bodyPost: bodyPost ? { ...bodyPost, diceRolls: [] } : null,
    _count: { posts: bodyPost ? 1 : 0 },
  };
}

const defaultSubthread = makeSub(
  "s1",
  "主帖",
  { id: "p1", content: "默认正文", version: 2 },
  0,
);
const secondSubthread = makeSub("s2", "设定区", null, 1);
const thirdSubthread = makeSub(
  "s3",
  "剧情区",
  { id: "p3", content: "剧情正文", version: 5 },
  2,
);

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
  subthreads: [defaultSubthread, secondSubthread, thirdSubthread],
  defaultSubthread,
  topicTags: [],
  _count: { members: 8, players: 3, posts: 2 },
  isBookmarked: false,
  bookmarkId: null,
  isLiked: false,
};

function renderPanel({
  thread = mockThread,
  searchParams = "",
  onUrlUpdate,
  onRefetch = vi.fn().mockResolvedValue(thread),
  resetUrlUpdateQueueOnMount = true,
}: {
  thread?: ThreadDetail;
  searchParams?: string;
  onUrlUpdate?: (event: UrlUpdateEvent) => void;
  onRefetch?: () => Promise<ThreadDetail | undefined>;
  resetUrlUpdateQueueOnMount?: boolean;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onExit = vi.fn();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={searchParams}
        onUrlUpdate={onUrlUpdate}
        resetUrlUpdateQueueOnMount={resetUrlUpdateQueueOnMount}
        hasMemory
      >
        <ManagementPanel thread={thread} onExit={onExit} onRefetch={onRefetch} />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  return { ...result, onExit, onRefetch };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
  mocks.auth.mockReturnValue({ user: { id: "u1", username: "test" } });
  mocks.permissions.mockReturnValue({ isOwner: true, isCollaborator: false });
  mocks.createSubthread.mockResolvedValue(makeSub("s4", "新子贴", null, 3));
  mocks.updateSubthread.mockImplementation(async ({ body }: {
    body: { title: string; postingPolicy: "PARTICIPANTS" | "COLLABORATORS" | "PLAYERS" };
  }) => ({ ...secondSubthread, ...body, version: 2 }));
  mocks.deleteSubthread.mockResolvedValue({});
  mocks.reorderSubthreads.mockResolvedValue({});
  mocks.uploadImage.mockResolvedValue("https://example.com/test.png");
  mocks.upsertBody.mockImplementation(async ({ content }: { content: string }) => ({
    id: "p2",
    content,
    version: 2,
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ManagementPanel", () => {
  test("默认进入帖子设置并展示统一工具栏", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "返回帖子" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "测试帖" })).toBeInTheDocument();
    expect(screen.getByText("楼主")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "帖子设置" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /子贴内容 2/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /成员权限 8/ })).toBeInTheDocument();
    expect(screen.getByTestId("thread-edit-form")).toBeInTheDocument();
    expect(screen.getByText("已保存")).toBeInTheDocument();
  });

  test("从稳定 URL 恢复成员与指定子贴视图", () => {
    renderPanel({ searchParams: "?view=members" });
    expect(screen.getByTestId("member-manager")).toBeInTheDocument();
    expect(screen.getByText("权限修改即时生效")).toBeInTheDocument();

    cleanup();
    renderPanel({ searchParams: "?view=subthreads&subthread=s3" });
    expect(screen.getByDisplayValue("剧情区")).toBeInTheDocument();
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("剧情正文");
  });

  test("无效子贴参数回落到第一篇真实子贴并替换 URL", async () => {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    renderPanel({
      searchParams: "?view=subthreads&subthread=missing",
      onUrlUpdate,
      resetUrlUpdateQueueOnMount: false,
    });

    expect(screen.getByDisplayValue("设定区")).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
        searchParams: new URLSearchParams("view=subthreads&subthread=s2"),
      }));
    });
  });

  test("切换页签写入 URL，成员修改说明为即时生效", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    renderPanel({ onUrlUpdate });

    await user.click(screen.getByRole("tab", { name: /成员权限/ }));
    expect(screen.getByTestId("member-manager")).toBeInTheDocument();
    expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      searchParams: new URLSearchParams("view=members"),
    }));
  });

  test("帖子修改持续显示保存状态并支持 Ctrl+S", async () => {
    const user = userEvent.setup();
    renderPanel();

    const saveButton = screen.getByRole("button", { name: "保存帖子" });
    expect(saveButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "模拟修改帖子" }));
    expect(screen.getAllByText("有未保存修改").length).toBeGreaterThan(0);
    expect(saveButton).toBeEnabled();

    await user.keyboard("{Control>}s{/Control}");
    expect(mocks.settingsSubmit).toHaveBeenCalledTimes(1);
    expect(saveButton).toBeDisabled();
  });

  test("取消放弃帖子修改时保留当前页签，返回也不会退出", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => false));
    const { onExit } = renderPanel();

    await user.click(screen.getByRole("button", { name: "模拟修改帖子" }));
    await user.click(screen.getByRole("tab", { name: /子贴内容/ }));
    expect(window.confirm).toHaveBeenCalledWith("当前修改尚未保存，确定要放弃吗？");
    expect(screen.getByTestId("thread-edit-form")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "返回帖子" }));
    expect(onExit).not.toHaveBeenCalled();
  });

  test("有未保存修改时注册刷新关闭保护", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "模拟修改帖子" }));

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  test("子贴工作区排除主帖并内联编辑标题、权限与正文", () => {
    renderPanel({ searchParams: "?view=subthreads&subthread=s2" });

    expect(screen.queryByText("select-s1")).not.toBeInTheDocument();
    expect(screen.getByText("select-s2")).toBeInTheDocument();
    expect(screen.getByLabelText("子贴标题")).toHaveValue("设定区");
    expect(screen.getByRole("combobox", { name: "发帖权限" })).toHaveTextContent("所有参与人");
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("");
  });

  test("一次保存同时提交实际变更的元数据与正文", async () => {
    const user = userEvent.setup();
    renderPanel({ searchParams: "?view=subthreads&subthread=s2" });

    await user.clear(screen.getByLabelText("子贴标题"));
    await user.type(screen.getByLabelText("子贴标题"), "新设定区");
    await user.click(screen.getByRole("combobox", { name: "发帖权限" }));
    await user.click(await screen.findByRole("option", { name: "仅玩家" }));
    await user.type(screen.getByTestId("milkdown-editor"), "设定正文");
    await user.click(screen.getByRole("button", { name: "保存子贴" }));

    expect(mocks.updateSubthread).toHaveBeenCalledWith({
      subthreadId: "s2",
      body: {
        title: "新设定区",
        postingPolicy: "PLAYERS",
        version: 1,
      },
    });
    expect(mocks.upsertBody).toHaveBeenCalledWith({
      subthreadId: "s2",
      threadId: "t1",
      content: "设定正文",
      version: undefined,
    });
    expect(toast.success).toHaveBeenCalledWith("子贴修改已保存");
  });

  test("切换章节、撤销正文修改与图片上传均走当前子贴上下文", async () => {
    const user = userEvent.setup();
    renderPanel({ searchParams: "?view=subthreads&subthread=s2" });

    await user.click(screen.getByText("select-s3"));
    expect(screen.getByLabelText("子贴标题")).toHaveValue("剧情区");

    await user.type(screen.getByTestId("milkdown-editor"), "本地补充");
    await user.click(screen.getByRole("button", { name: "撤销未保存修改" }));
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("剧情正文");

    await user.click(screen.getByRole("button", { name: "mock-upload" }));
    expect(mocks.uploadImage).toHaveBeenCalledWith(expect.any(File), undefined);
  });

  test("空标题与空正文在提交前给出就地错误", async () => {
    const user = userEvent.setup();
    renderPanel({ searchParams: "?view=subthreads&subthread=s3" });

    await user.clear(screen.getByLabelText("子贴标题"));
    await user.click(screen.getByRole("button", { name: "保存子贴" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请输入子贴标题");

    await user.type(screen.getByLabelText("子贴标题"), "剧情区");
    await user.clear(screen.getByTestId("milkdown-editor"));
    await user.click(screen.getByRole("button", { name: "保存子贴" }));
    expect(screen.getByRole("alert")).toHaveTextContent("正文不能为空");
  });

  test("元数据成功但正文失败时保留未保存状态并提示部分成功", async () => {
    const user = userEvent.setup();
    mocks.upsertBody.mockRejectedValueOnce({ message: "网络错误" });
    renderPanel({ searchParams: "?view=subthreads&subthread=s2" });

    await user.clear(screen.getByLabelText("子贴标题"));
    await user.type(screen.getByLabelText("子贴标题"), "新设定区");
    await user.type(screen.getByTestId("milkdown-editor"), "本地正文");
    await user.click(screen.getByRole("button", { name: "保存子贴" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("部分修改已保存");
    expect(toast.error).toHaveBeenCalledWith("部分修改已保存");
    expect(screen.getByRole("button", { name: "保存子贴" })).toBeEnabled();
  });

  test("保存既有正文时传递版本且不裁剪首尾内容", async () => {
    const user = userEvent.setup();
    renderPanel({ searchParams: "?view=subthreads&subthread=s3" });
    const content = "  新剧情\n\n<br />\n";

    await user.clear(screen.getByTestId("milkdown-editor"));
    await user.type(screen.getByTestId("milkdown-editor"), content);
    await user.click(screen.getByRole("button", { name: "保存子贴" }));

    expect(mocks.upsertBody).toHaveBeenCalledWith(expect.objectContaining({
      subthreadId: "s3",
      content,
      version: 5,
    }));
  });

  test("乐观锁冲突保留本地正文并提供复制和载入最新版本", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mocks.upsertBody.mockRejectedValueOnce({ code: 40002, message: "版本冲突" });
    const latest = {
      ...mockThread,
      subthreads: [
        defaultSubthread,
        { ...secondSubthread, bodyPost: { id: "p2", content: "服务端新正文", version: 3, diceRolls: [] } },
        thirdSubthread,
      ],
    };
    const onRefetch = vi.fn().mockResolvedValue(latest);
    renderPanel({ searchParams: "?view=subthreads&subthread=s2", onRefetch });

    await user.type(screen.getByTestId("milkdown-editor"), "本地正文");
    await user.click(screen.getByRole("button", { name: "保存子贴" }));
    expect(await screen.findByText("检测到内容版本冲突")).toBeInTheDocument();
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("本地正文");

    await user.click(screen.getByRole("button", { name: "复制本地正文" }));
    expect(writeText).toHaveBeenCalledWith("本地正文");
    await user.click(screen.getByRole("button", { name: "载入最新版本" }));
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("服务端新正文");
  });

  test("新建子贴后自动选中、写入 URL 并请求正文聚焦", async () => {
    const user = userEvent.setup();
    const created = makeSub("s4", "新子贴", null, 3);
    const refreshed = { ...mockThread, subthreads: [...mockThread.subthreads, created] };
    const onRefetch = vi.fn().mockResolvedValue(refreshed);
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    renderPanel({
      searchParams: "?view=subthreads&subthread=s2",
      onRefetch,
      onUrlUpdate,
    });

    await user.click(screen.getByText("mock-add-subthread"));
    await user.type(screen.getByPlaceholderText("主帖 / 设定区 / 剧情区"), "新子贴");
    await user.click(screen.getByRole("button", { name: "添加" }));

    expect(mocks.createSubthread).toHaveBeenCalledWith(expect.objectContaining({
      threadId: "t1",
      body: expect.objectContaining({
        title: "新子贴",
        clientRequestId: expect.any(String),
      }),
    }));
    expect(await screen.findByDisplayValue("新子贴")).toBeInTheDocument();
    expect(screen.getByTestId("milkdown-editor")).toHaveAttribute("data-auto-focus", "true");
    expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      searchParams: new URLSearchParams("view=subthreads&subthread=s4"),
    }));

    await user.click(screen.getByText("mock-add-subthread"));
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog", { name: "添加子贴" })).not.toBeInTheDocument();
  });

  test("删除当前子贴后选择相邻章节", async () => {
    const user = userEvent.setup();
    const refreshed = {
      ...mockThread,
      subthreads: [defaultSubthread, secondSubthread],
    };
    const onRefetch = vi.fn().mockResolvedValue(refreshed);
    renderPanel({
      searchParams: "?view=subthreads&subthread=s3",
      onRefetch,
    });

    await user.click(screen.getByText("delete-s3"));
    expect(window.confirm).toHaveBeenCalledWith("该子贴及其中 1 个楼层 将被删除，无法恢复。");
    expect(mocks.deleteSubthread).toHaveBeenCalledWith("s3");
    expect(await screen.findByDisplayValue("设定区")).toBeInTheDocument();
  });

  test("排序失败回滚目录并显示明确反馈", async () => {
    const user = userEvent.setup();
    mocks.reorderSubthreads.mockRejectedValueOnce({ message: "网络错误" });
    renderPanel({ searchParams: "?view=subthreads&subthread=s2" });
    const tree = screen.getByTestId("subthread-tree");

    expect(within(tree).getAllByRole("button", { name: /select-/ }).map((button) => button.textContent))
      .toEqual(["select-s2", "select-s3"]);
    await user.click(screen.getByText("mock-reorder"));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("排序保存失败，已恢复原顺序");
      expect(within(tree).getAllByRole("button", { name: /select-/ }).map((button) => button.textContent))
        .toEqual(["select-s2", "select-s3"]);
    });
  });

  test("排序成功提交主帖优先的完整顺序", async () => {
    const user = userEvent.setup();
    const { onRefetch } = renderPanel({ searchParams: "?view=subthreads&subthread=s2" });

    await user.click(screen.getByText("mock-reorder"));
    expect(mocks.reorderSubthreads).toHaveBeenCalledWith({
      threadId: "t1",
      ids: ["s1", "s3", "s2"],
    });
    await vi.waitFor(() => expect(onRefetch).toHaveBeenCalledTimes(1));
  });

  test("未保存修改会拦截站内链接和历史返回", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => false));
    renderPanel();
    await user.click(screen.getByRole("button", { name: "模拟修改帖子" }));

    const anchor = document.createElement("a");
    anchor.href = "/threads/other";
    anchor.textContent = "其他帖子";
    document.body.appendChild(anchor);
    fireEvent.click(anchor);
    await vi.waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));

    fireEvent.popState(window);
    await vi.waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(2));
    anchor.remove();
    expect(screen.getByTestId("thread-edit-form")).toBeInTheDocument();
  });

  test("协作者身份在工具栏和成员权限页保持明确", async () => {
    const user = userEvent.setup();
    mocks.auth.mockReturnValue({ user: { id: "u2", username: "collaborator" } });
    mocks.permissions.mockReturnValue({ isOwner: false, isCollaborator: true });
    renderPanel();

    expect(screen.getByText("协作者")).toBeInTheDocument();
    expect(screen.getByText("帖子设置 isOwner=false")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /成员权限/ }));
    expect(screen.getByText("成员权限 isOwner=false isCollaborator=true")).toBeInTheDocument();
  });

  test("没有真实子贴时显示可行动的空状态", async () => {
    const user = userEvent.setup();
    const thread = { ...mockThread, subthreads: [defaultSubthread] };
    renderPanel({ thread, searchParams: "?view=subthreads" });

    expect(screen.getByText("从第一篇子贴开始")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "添加子贴" }));
    expect(screen.getByText("添加子贴", { selector: "h2" })).toBeInTheDocument();
  });
});
