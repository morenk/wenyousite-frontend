/** ThreadComposer 测试：按需挂载唯一编辑器并统一创建、回复与编辑提交 */

import { useState } from "react";
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
  rp: false,
  prepare: vi.fn(),
  requireConfirmation: vi.fn(),
  create: vi.fn().mockResolvedValue({ id: "created-post" }),
  update: vi.fn().mockResolvedValue({}),
  upload: vi.fn().mockResolvedValue("https://example.com/image.webp"),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/components/thread/thread-permissions-context", () => ({
  useThreadPermissions: () => ({ rpIdentitySupported: mocks.rp }),
}));
vi.mock("@/components/thread/use-thread-identity-submission", () => ({
  useThreadIdentitySubmission: () => ({ prepare: mocks.prepare, requireConfirmation: mocks.requireConfirmation, query: { data: {} } }),
}));
vi.mock("@/components/thread/thread-publication-identity", () => ({
  ThreadPublicationIdentity: ({ disabled }: { disabled: boolean }) => <button disabled={disabled}>身份选择</button>,
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

vi.mock("@/components/editor/milkdown-editor", async () => {
  const { withEditorSubmission } = await import("@/test/editor-submission-double");
  return ({
  MilkdownEditor: withEditorSubmission(({
    defaultValue,
    onChange,
    onSyncErrorChange,
    placeholder,
    disabled,
  }: {
    defaultValue?: string;
    onChange?: (value: string) => void;
    onSyncErrorChange?: (hasError: boolean) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <>
    <textarea
      disabled={disabled}
      data-testid="milkdown-editor"
      aria-label={placeholder}
      defaultValue={defaultValue}
      onChange={(event) => onChange?.(event.target.value)}
    />
    <button onClick={() => onSyncErrorChange?.(true)}>模拟同步失败</button>
    <button onClick={() => onSyncErrorChange?.(false)}>模拟同步恢复</button>
    </>
  )),
});
});

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
  const [reset, setReset] = useState(0);
  const { open } = useThreadComposer();
  return (
    <>
      <button onClick={() => setReset((value) => value + 1)}>刷新楼层视图</button>
      <button onClick={() => open(sessions.create)}>发表入口</button>
      <button onClick={() => open(sessions.reply)}>回复入口</button>
      <button onClick={() => open(sessions.edit)}>编辑入口</button>
      <ThreadComposerOutlet key={"create-" + reset} anchorId="create-floor:s1" />
      <ThreadComposerOutlet key={"reply-" + reset} anchorId="reply:post-1" />
      <ThreadComposerOutlet key={"edit-" + reset} anchorId="reply:reply-2" />
    </>
  );
}

function renderHarness() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ThreadComposerProvider threadId="thread-1">
        <Harness />
      </ThreadComposerProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("ThreadComposer", () => {
test("RP结果不明时连mode/token/正文/UUID冻结，重试不重新准备身份", async () => {
  mocks.rp = true; mocks.prepare.mockResolvedValue({ identityMode: "RP", identityId: "rp-selected", identityToken: "original-token" });
  mocks.create.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce({ id: "created" });
  renderHarness();
  await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
  await userEvent.type(screen.getByTestId("milkdown-editor"), "原正文");
  await userEvent.click(screen.getByRole("button", { name: "发布" }));
  await screen.findByRole("button", { name: "重试确认发表" });
  expect(screen.getByRole("button", { name: "身份选择" })).toBeDisabled();
  expect(screen.getByTestId("milkdown-editor")).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "回复入口" }));
  expect(screen.queryByText("回复 @小明")).not.toBeInTheDocument();
  const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "刷新楼层视图" }));
  expect(screen.getByTestId("milkdown-editor")).toHaveValue("原正文");
  expect(screen.getByTestId("milkdown-editor")).toBeDisabled();
  mocks.prepare.mockResolvedValue({ identityMode: "ACCOUNT" });
  await userEvent.click(screen.getByRole("button", { name: "重试确认发表" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
  expect(mocks.prepare).toHaveBeenCalledOnce();
  expect(mocks.create.mock.calls[1]?.[0]).toEqual(mocks.create.mock.calls[0]?.[0]);
  expect(mocks.create.mock.calls[1]?.[0]).toMatchObject({ identityMode: "RP", identityId: "rp-selected", identityToken: "original-token", content: "原正文" });
});
test("40011保留正文并要求确认，明确失败后使用新UUID；编辑旧帖不送新身份", async () => {
  mocks.rp = true; mocks.prepare.mockResolvedValue({ identityMode: "RP", identityId: "rp-selected", identityToken: "token" });
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("uuid-one").mockReturnValueOnce("uuid-two") });
  mocks.create.mockRejectedValueOnce({ code: 40011, status: 409 }).mockResolvedValueOnce({ id: "created" });
  renderHarness();
  await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
  await userEvent.type(screen.getByTestId("milkdown-editor"), "保留正文");
  await userEvent.click(screen.getByRole("button", { name: "发布" }));
  await waitFor(() => expect(mocks.requireConfirmation).toHaveBeenCalledOnce());
  expect(screen.getByTestId("milkdown-editor")).toHaveValue("保留正文");
  expect(screen.getByTestId("milkdown-editor")).not.toBeDisabled();
  mocks.prepare.mockResolvedValue({ identityMode: "ACCOUNT" });
  await userEvent.click(screen.getByRole("button", { name: "发布" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
  expect(mocks.create.mock.calls[1]?.[0]).toMatchObject({ clientRequestId: "uuid-two", identityMode: "ACCOUNT" });
  await userEvent.click(screen.getByRole("button", { name: "编辑入口" }));
  expect(screen.queryByRole("button", { name: "身份选择" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "保存修改" }));
  expect(mocks.update).toHaveBeenCalledWith({ postId: "reply-2", content: "原回复", version: 3 });
});

  test("身份入口替换普通发表标题，回复对象和编辑语义仍保留", async () => {
    mocks.rp = true;
    renderHarness();
    await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
    expect(screen.getByRole("button", { name: "身份选择" })).toBeInTheDocument();
    expect(screen.queryByText("发表回复")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "回复入口" }));
    expect(screen.getByText("回复 @小明")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "身份选择" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "编辑入口" }));
    expect(screen.getByText("编辑回复")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "身份选择" })).not.toBeInTheDocument();
  });

  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rp = false; mocks.prepare.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => REQUEST_ID) });
  });

  test.each(["发表入口", "回复入口", "编辑入口"])("%s 同步失败禁止提交，恢复后才能写入", async (entry) => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: entry }));
    await user.type(screen.getByTestId("milkdown-editor"), "新增正文");
    await user.click(screen.getByRole("button", { name: "模拟同步失败" }));
    const submit = screen.getByRole("button", { name: /^(发布|回复|保存修改)$/ });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "模拟同步恢复" }));
    await user.click(submit);
    await waitFor(() => expect(entry === "编辑入口" ? mocks.update : mocks.create).toHaveBeenCalled());
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

  test("发布时保留正文首尾内容", async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: "发表入口" }));
    fireEvent.change(screen.getByTestId("milkdown-editor"), {
      target: { value: "  正文\n\n<br />\n" },
    });
    await user.click(screen.getByRole("button", { name: "发布" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({
      subthreadId: "s1",
      content: "  正文\n\n<br />\n",
      clientRequestId: REQUEST_ID,
    }));
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
    expect(screen.getByTestId("milkdown-editor")).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "重试确认发表" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[0]?.[0].clientRequestId).toBe(REQUEST_ID);
    expect(mocks.create.mock.calls[1]?.[0].clientRequestId).toBe(REQUEST_ID);
  });

  test("确认无写入的业务失败后修改正文生成新的 clientRequestId", async () => {
    const user = userEvent.setup();
    const nextRequestId = "d9428888-122b-4c71-9a16-6f91a7c31917";
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn().mockReturnValueOnce(REQUEST_ID).mockReturnValueOnce(nextRequestId),
    });
    mocks.create.mockRejectedValueOnce({ code: 40012, message: "提及已变化" }).mockResolvedValueOnce({ id: "created-post" });
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

  test("回复目标失效时强制关闭编辑器并清除主题正文缓存", async () => {
    const user = userEvent.setup();
    mocks.create.mockRejectedValueOnce({ code: 40403, message: "帖子不存在" });
    const queryClient = renderHarness();
    queryClient.setQueryData(["thread", "thread-1", "viewer", "u1"], { title: "私密正文" });
    queryClient.setQueryData(["floors", "subthread-1"], [{ id: "post-1" }]);

    await user.click(screen.getByRole("button", { name: "回复入口" }));
    await user.type(screen.getByTestId("milkdown-editor"), "已经失效的回复");
    await user.click(screen.getByRole("button", { name: /^回复$/ }));

    await waitFor(() => {
      expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument();
    });
    expect(queryClient.getQueryData(["thread", "thread-1", "viewer", "u1"])).toBeUndefined();
    expect(queryClient.getQueryData(["floors", "subthread-1"])).toBeUndefined();
    expect(mocks.error).toHaveBeenCalledWith("内容已删除或当前无法访问");
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
