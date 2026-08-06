/** ThreadComposer 测试：按需挂载唯一编辑器并统一创建、回复与编辑提交 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ThreadComposerProvider,
  useThreadComposer,
  type ThreadComposerSession,
} from "@/components/thread/thread-composer-context";
import { ThreadComposerOutlet } from "@/components/thread/thread-composer";

const mocks = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({ id: "created-post" }),
  update: vi.fn().mockResolvedValue({}),
  upload: vi.fn().mockResolvedValue("https://example.com/image.webp"),
  success: vi.fn(),
  error: vi.fn(),
}));

const REQUEST_ID = "6f9619ff-8b86-4e4b-a59b-19a25f6d6f77";

vi.mock("@/api/hooks/use-create-post", () => ({
  useCreatePost: () => ({ mutateAsync: mocks.create }),
}));

vi.mock("@/api/hooks/use-update-post", () => ({
  useUpdatePost: () => ({ mutateAsync: mocks.update }),
}));

vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({ mutateAsync: mocks.upload }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

vi.mock("@/components/editor/milkdown-editor", () => ({
  MilkdownEditor: ({
    defaultValue,
    onChange,
    placeholder,
  }: {
    defaultValue?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="milkdown-editor"
      aria-label={placeholder}
      defaultValue={defaultValue}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

const sessions: Record<string, ThreadComposerSession> = {
  create: {
    key: "create-floor:s1",
    anchorId: "create-floor:s1",
    type: "create-floor",
    subthreadId: "s1",
    label: "发表回复",
    initialContent: "",
  },
  reply: {
    key: "reply:post-1",
    anchorId: "reply:post-1",
    type: "reply",
    subthreadId: "s1",
    parentPostId: "post-1",
    replyToPostId: "reply-2",
    label: "回复 @小明",
    initialContent: "",
  },
  edit: {
    key: "edit:reply-2",
    anchorId: "reply:reply-2",
    type: "edit",
    subthreadId: "s1",
    postId: "reply-2",
    parentPostId: "post-1",
    version: 3,
    label: "编辑回复",
    initialContent: "原回复",
  },
};

function Harness() {
  const { open } = useThreadComposer();
  return (
    <>
      <button onClick={() => open(sessions.create)}>发表入口</button>
      <button onClick={() => open(sessions.reply)}>回复入口</button>
      <button onClick={() => open(sessions.edit)}>编辑入口</button>
      <ThreadComposerOutlet anchorId="create-floor:s1" />
      <ThreadComposerOutlet anchorId="reply:post-1" />
      <ThreadComposerOutlet anchorId="reply:reply-2" />
    </>
  );
}

function renderHarness() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ThreadComposerProvider>
        <Harness />
      </ThreadComposerProvider>
    </QueryClientProvider>,
  );
}

describe("ThreadComposer", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => REQUEST_ID) });
  });

  test("浏览态不挂载编辑器，点击入口后始终只挂载一个", async () => {
    const user = userEvent.setup();
    renderHarness();

    expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "发表入口" }));
    expect(screen.getAllByTestId("milkdown-editor")).toHaveLength(1);
    expect(screen.getByText("发表回复")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "回复入口" }));
    expect(screen.getAllByTestId("milkdown-editor")).toHaveLength(1);
    expect(screen.getByText("回复 @小明")).toBeInTheDocument();
  });

  test("楼中楼回复提交完整目标参数，缓存刷新交给领域 hook", async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: "回复入口" }));
    await user.type(screen.getByTestId("milkdown-editor"), "回复内容");
    await user.click(screen.getByRole("button", { name: /^回复$/ }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({
      subthreadId: "s1",
      content: "回复内容",
      parentPostId: "post-1",
      replyToPostId: "reply-2",
      clientRequestId: REQUEST_ID,
    }));
    expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument();
  });

  test("只输入 CommonMark 自动链接也可以发布回复", async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: "发表入口" }));
    await user.type(
      screen.getByTestId("milkdown-editor"),
      "<https://wenyou.site/threads/example>",
    );
    await user.click(screen.getByRole("button", { name: "发布" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({
      subthreadId: "s1",
      content: "<https://wenyou.site/threads/example>",
      clientRequestId: REQUEST_ID,
    }));
    expect(mocks.error).not.toHaveBeenCalled();
  });

  test("楼层可以只提交正文内的骰子节点，正式结果由服务端生成", async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: "发表入口" }));
    const marker =
      "[[dice:v1:550e8400-e29b-41d4-a716-446655440000:1d20]]";
    fireEvent.change(screen.getByTestId("milkdown-editor"), {
      target: { value: marker },
    });
    await user.click(screen.getByRole("button", { name: "发布" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({
      subthreadId: "s1",
      content: marker,
      clientRequestId: REQUEST_ID,
    }));
  });

  test("相同正文失败后重试复用 clientRequestId", async () => {
    const user = userEvent.setup();
    mocks.create.mockRejectedValueOnce(new Error("网络超时")).mockResolvedValueOnce({ id: "created-post" });
    renderHarness();
    await user.click(screen.getByRole("button", { name: "发表入口" }));
    await user.type(screen.getByTestId("milkdown-editor"), "重试正文");

    await user.click(screen.getByRole("button", { name: "发布" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "发布" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[0]?.[0].clientRequestId).toBe(REQUEST_ID);
    expect(mocks.create.mock.calls[1]?.[0].clientRequestId).toBe(REQUEST_ID);
  });

  test("失败后修改正文会生成新的 clientRequestId", async () => {
    const user = userEvent.setup();
    const nextRequestId = "d9428888-122b-4c71-9a16-6f91a7c31917";
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn().mockReturnValueOnce(REQUEST_ID).mockReturnValueOnce(nextRequestId),
    });
    mocks.create.mockRejectedValueOnce(new Error("网络超时")).mockResolvedValueOnce({ id: "created-post" });
    renderHarness();
    await user.click(screen.getByRole("button", { name: "发表入口" }));
    const editor = screen.getByTestId("milkdown-editor");
    await user.type(editor, "原正文");
    await user.click(screen.getByRole("button", { name: "发布" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());

    await user.type(editor, "已修改");
    await user.click(screen.getByRole("button", { name: "发布" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[0]?.[0].clientRequestId).toBe(REQUEST_ID);
    expect(mocks.create.mock.calls[1]?.[0].clientRequestId).toBe(nextRequestId);
  });

  test("编辑楼中楼回填原文并使用乐观锁保存", async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: "编辑入口" }));

    const editor = screen.getByTestId("milkdown-editor");
    expect(editor).toHaveValue("原回复");
    await user.clear(editor);
    await user.type(editor, "修改后");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({
      postId: "reply-2",
      content: "修改后",
      version: 3,
    }));
    expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument();
  });
});
