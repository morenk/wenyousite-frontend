/** ThreadComposer 测试：按需挂载唯一编辑器并统一创建、回复与编辑提交 */

import { useState } from "react";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ThreadComposerProvider,
  ThreadReplyDraftsProvider,
  useThreadComposer,
  type ThreadComposerSession,
} from "@/components/thread/thread-composer-context";
import { ThreadComposerOutlet } from "@/components/thread/thread-composer";

const mocks = vi.hoisted(() => ({
  rp: false,
  readIdentities: vi.fn(),
  identityEnabled: true,
  identityEligible: true,
  deferChange: false,
  uploadPending: false,
  prepare: vi.fn(),
  requireConfirmation: vi.fn(),
  create: vi.fn().mockResolvedValue({ id: "created-post" }),
  update: vi.fn().mockResolvedValue({}),
  upload: vi.fn().mockResolvedValue("https://example.com/image.webp"),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/api/hooks/use-rp-identities", () => ({ readRpIdentities: mocks.readIdentities }));

vi.mock("@/components/thread/thread-permissions-context", () => ({
  useThreadPermissions: () => ({ rpIdentitySupported: mocks.rp }),
}));
vi.mock("@/components/thread/use-thread-identity-submission", () => ({
  useThreadIdentitySubmission: () => ({ prepare: mocks.prepare, requireConfirmation: mocks.requireConfirmation, query: { data: { enabled: mocks.identityEnabled, eligible: mocks.identityEligible } } }),
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
  useUploadImage: () => ({ mutateAsync: mocks.upload, isPending: mocks.uploadPending }),
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
  ), { deferChange: () => mocks.deferChange }),
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

function renderHarness(persistent = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      {persistent ? <ThreadReplyDraftsProvider accountId="persist-user"><ThreadComposerProvider threadId="thread-1"><Harness /></ThreadComposerProvider></ThreadReplyDraftsProvider> : <ThreadComposerProvider threadId="thread-1"><Harness /></ThreadComposerProvider>}
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("ThreadComposer", () => {
test.each(["发表入口", "回复入口"])("%s的身份行与编辑器共用不透明背景", async (entry) => {
  mocks.rp = true;
  renderHarness();
  await userEvent.click(screen.getByRole("button", { name: entry }));
  const identity = screen.getByRole("button", { name: "身份选择" });
  const composer = identity.parentElement;
  expect(composer).toHaveClass("bg-background", "rounded-[var(--radius-control)]");
  expect(composer).toContainElement(screen.getByTestId("milkdown-editor"));
});

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
  vi.stubGlobal("crypto", { subtle: webcrypto.subtle, randomUUID: vi.fn().mockReturnValueOnce("uuid-one").mockReturnValueOnce("uuid-two") });
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
    expect(screen.getByTestId("editor-header")).toHaveTextContent("回复 @小明");
    expect(screen.getByRole("button", { name: "身份选择" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "编辑入口" }));
    expect(screen.getByTestId("editor-header")).toHaveTextContent("编辑回复");
    expect(screen.queryByRole("button", { name: "身份选择" })).not.toBeInTheDocument();
  });

  test.each([
    { enabled: false, eligible: true },
    { enabled: true, eligible: false },
  ])("开关/资格失效后隐藏身份并保留正文：%j", async ({ enabled, eligible }) => {
    mocks.rp = true;
    renderHarness();
    await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
    expect(screen.getByRole("button", { name: "身份选择" })).toBeInTheDocument();
    mocks.identityEnabled = enabled;
    mocks.identityEligible = eligible;
    await userEvent.type(screen.getByTestId("milkdown-editor"), "继续编辑正文");
    expect(screen.queryByRole("button", { name: "身份选择" })).not.toBeInTheDocument();
    expect(screen.queryByText("发表回复")).not.toBeInTheDocument();
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("继续编辑正文");
    await userEvent.click(screen.getByRole("button", { name: "回复入口" }));
    expect(screen.getByText("回复 @小明")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "身份选择" })).not.toBeInTheDocument();
  });

  test.each([true, false])("RP未确认请求硬重载后校验摘要并保留原UUID：token相同=%s", async (same) => {
    mocks.rp = true;
    mocks.prepare.mockResolvedValue({ identityMode: "RP", identityId: "rp-selected", identityToken: "original-token" });
    mocks.create.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce({ id: "created" });
    renderHarness(true);
    await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
    await userEvent.type(screen.getByTestId("milkdown-editor"), "本地未知请求");
    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    await screen.findByRole("button", { name: "重试确认发表" });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const original = mocks.create.mock.calls[0][0];
    expect(Object.values(localStorage).join("")).not.toContain("original-token");
    cleanup();
    mocks.readIdentities.mockResolvedValue({ identities: [{ identityId: "rp-selected", identityToken: same ? "original-token" : "changed-token" }] });
    renderHarness(true);
    await userEvent.click(screen.getByRole("button", { name: "回复入口" }));
    expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
    await expect(screen.getByTestId("milkdown-editor")).toHaveValue("本地未知请求");
    await userEvent.click(screen.getByRole("button", { name: "重试确认发表" }));
    await waitFor(() => expect(mocks.readIdentities).toHaveBeenCalled());
    if (same) {
      await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
      expect(mocks.create.mock.calls[1][0]).toEqual(original);
    } else {
      await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("原发言身份已变化")));
      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("milkdown-editor")).toBeDisabled();
    }
  });

  test.each([{ status: 429, code: 42900 }, { status: 403, code: 40300 }, { status: 401, code: 40100 }, { status: 403 }, { status: 404 }, { code: 40402, status: 404 }])("恢复未知RP请求时身份GET %j不能清理原UUID或改成新发表", async (error) => {
    mocks.rp = true;
    mocks.prepare.mockResolvedValue({ identityMode: "RP", identityId: "rp-selected", identityToken: "original-token" });
    mocks.create.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce({ id: "created" });
    renderHarness(true);
    await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
    await userEvent.type(screen.getByTestId("milkdown-editor"), "原请求正文");
    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    await screen.findByRole("button", { name: "重试确认发表" });
    const original = mocks.create.mock.calls[0][0];
    cleanup();
    mocks.readIdentities.mockRejectedValueOnce(error)
      .mockResolvedValue({ identities: [{ identityId: "rp-selected", identityToken: "original-token" }] });
    renderHarness(true);
    await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
    await userEvent.click(screen.getByRole("button", { name: "重试确认发表" }));
    await waitFor(() => expect(mocks.readIdentities).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "重试确认发表" })).toBeEnabled());
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("milkdown-editor")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "回复入口" }));
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("原请求正文");
    await userEvent.click(screen.getByRole("button", { name: "重试确认发表" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1][0]).toEqual(original);
  });

  test.each([429, 401, 403, 404])("恢复未知请求的POST %s也不证明原请求未成功，仍以原UUID重试", async (status) => {
    mocks.rp = true;
    mocks.prepare.mockResolvedValue({ identityMode: "RP", identityId: "rp-selected", identityToken: "original-token" });
    mocks.create.mockRejectedValueOnce(new TypeError("response lost"))
      .mockRejectedValueOnce({ status }).mockResolvedValueOnce({ id: "created" });
    renderHarness(true);
    await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
    await userEvent.type(screen.getByTestId("milkdown-editor"), "原请求完整正文");
    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    await screen.findByRole("button", { name: "重试确认发表" });
    const original = mocks.create.mock.calls[0][0];
    cleanup();
    mocks.readIdentities.mockResolvedValue({ identities: [{ identityId: "rp-selected", identityToken: "original-token" }] });
    renderHarness(true);
    await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
    await userEvent.click(screen.getByRole("button", { name: "重试确认发表" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "重试确认发表" })).toBeEnabled());
    expect(screen.getByTestId("milkdown-editor")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "重试确认发表" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(3));
    expect(mocks.create.mock.calls[1][0]).toEqual(original);
    expect(mocks.create.mock.calls[2][0]).toEqual(original);
  });

  test("摘要准备失败不发送请求，正文仍可编辑；未知请求409不解锁新UUID", async () => {
    mocks.rp = true;
    mocks.prepare.mockResolvedValue({ identityMode: "RP", identityId: "rp-selected", identityToken: "original-token" });
    vi.stubGlobal("crypto", { randomUUID: () => REQUEST_ID, subtle: { digest: vi.fn().mockRejectedValue(new Error("digest unavailable")) } });
    renderHarness(true);
    await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
    await userEvent.type(screen.getByTestId("milkdown-editor"), "保留准备失败内容");
    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.create).not.toHaveBeenCalled();
    expect(screen.getByTestId("milkdown-editor")).not.toBeDisabled();
    cleanup();
    mocks.prepare.mockResolvedValue({ identityMode: "ACCOUNT" });
    mocks.create.mockRejectedValue({ code: 40002, status: 409 });
    renderHarness(true);
    await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    await screen.findByRole("button", { name: "重试确认发表" });
    await userEvent.click(screen.getByRole("button", { name: "重试确认发表" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1][0].clientRequestId).toBe(mocks.create.mock.calls[0][0].clientRequestId);
    expect(screen.getByTestId("milkdown-editor")).toBeDisabled();
  });

  afterEach(() => { cleanup(); localStorage.clear(); });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readIdentities.mockReset();
    mocks.create.mockReset().mockResolvedValue({ id: "created-post" });
    mocks.update.mockReset().mockResolvedValue({});
    mocks.identityEnabled = true; mocks.identityEligible = true;
    mocks.rp = false; mocks.deferChange = false; mocks.uploadPending = false; mocks.prepare.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("crypto", { subtle: webcrypto.subtle, randomUUID: vi.fn(() => REQUEST_ID) });
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
    expect(screen.queryByText("发表回复")).not.toBeInTheDocument();

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
    await user.click(document.body);
    expect(screen.getByTestId("milkdown-editor")).toHaveValue("重试正文");
    await user.click(screen.getByRole("button", { name: "重试确认发表" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[0]?.[0].clientRequestId).toBe(REQUEST_ID);
    expect(mocks.create.mock.calls[1]?.[0].clientRequestId).toBe(REQUEST_ID);
  });

  test("确认无写入的业务失败后修改正文生成新的 clientRequestId", async () => {
    const user = userEvent.setup();
    const nextRequestId = "d9428888-122b-4c71-9a16-6f91a7c31917";
    vi.stubGlobal("crypto", {
      subtle: webcrypto.subtle, randomUUID: vi.fn().mockReturnValueOnce(REQUEST_ID).mockReturnValueOnce(nextRequestId),
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


test("切换回复对象续写最后输入并向新目标提交，成功后新开为空", async () => {
  mocks.deferChange = true;
  renderHarness();
  await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
  await userEvent.type(screen.getByTestId("milkdown-editor"), "还没同步的正文");
  await userEvent.click(screen.getByRole("button", { name: "回复入口" }));
  expect(screen.getByTestId("milkdown-editor")).toHaveValue("还没同步的正文");
  expect(confirm).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: /^回复$/ }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
    content: "还没同步的正文", parentPostId: "post-1", replyToPostId: "reply-2",
  })));
  await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
  expect(screen.getByTestId("milkdown-editor")).toHaveValue("");
});

test("明确失败后收起保留正文，再开普通楼层提交不携带旧回复对象", async () => {
  mocks.create.mockRejectedValueOnce({ status: 400, code: 40012 });
  renderHarness();
  await userEvent.click(screen.getByRole("button", { name: "回复入口" }));
  await userEvent.type(screen.getByTestId("milkdown-editor"), "失败后续写");
  await userEvent.click(screen.getByRole("button", { name: /^回复$/ }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
  await userEvent.click(document.body);
  await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
  expect(screen.getByTestId("milkdown-editor")).toHaveValue("失败后续写");
  await userEvent.click(screen.getByRole("button", { name: "发布" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
  expect(mocks.create.mock.calls[1]?.[0]).not.toHaveProperty("parentPostId");
  expect(mocks.create.mock.calls[1]?.[0]).not.toHaveProperty("replyToPostId");
});

test("临时回复与编辑原帖往返不串正文，保存原帖后仍可续写回复", async () => {
  renderHarness();
  await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
  await userEvent.type(screen.getByTestId("milkdown-editor"), "我的临时回复");
  await userEvent.click(screen.getByRole("button", { name: "编辑入口" }));
  expect(screen.getByTestId("milkdown-editor")).toHaveValue("原回复");
  await userEvent.click(screen.getByRole("button", { name: "保存修改" }));
  await waitFor(() => expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole("button", { name: "回复入口" }));
  expect(screen.getByTestId("milkdown-editor")).toHaveValue("我的临时回复");
});

test("上传中的编辑器禁止切换到另一回复入口", async () => {
  mocks.uploadPending = true;
  renderHarness();
  await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
  await userEvent.click(screen.getByRole("button", { name: "回复入口" }));
  expect(screen.queryByText("发表回复")).not.toBeInTheDocument();
  expect(screen.queryByText("回复 @小明")).not.toBeInTheDocument();
});


test("路由卸载前同步未 debounce 的最后一段，重挂后可在另一入口续写", async () => {
  mocks.deferChange = true;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (route: string) => <QueryClientProvider client={queryClient}>
    <ThreadReplyDraftsProvider accountId="u1">
      <ThreadComposerProvider key={route} threadId="t1"><Harness /></ThreadComposerProvider>
    </ThreadReplyDraftsProvider>
  </QueryClientProvider>;
  const { rerender } = render(view("a"));
  await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
  fireEvent.change(screen.getByTestId("milkdown-editor"), { target: { value: "最后一段未同步" } });
  rerender(view("b"));
  await userEvent.click(screen.getByRole("button", { name: "回复入口" }));
  expect(screen.getByTestId("milkdown-editor")).toHaveValue("最后一段未同步");
});


 test("外部点击同步最后输入并收起，重开保留草稿；发布位于编辑器页脚", async () => {
  mocks.deferChange = true;
  renderHarness();
  await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
  expect(screen.queryByRole("button", { name: "收起" })).not.toBeInTheDocument();
  expect(screen.getByTestId("editor-footer")).toContainElement(screen.getByRole("button", { name: "发布" }));
  await userEvent.type(screen.getByTestId("milkdown-editor"), "最后输入");
  await userEvent.click(document.body);
  expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
  expect(screen.getByTestId("milkdown-editor")).toHaveValue("最后输入");
 });
 test("外部点击不能收起上传中的编辑器", async () => {
  mocks.uploadPending = true;
  renderHarness();
  await userEvent.click(screen.getByRole("button", { name: "发表入口" }));
  await userEvent.type(screen.getByTestId("milkdown-editor"), "上传中的正文");
  await userEvent.click(document.body);
  expect(screen.getByTestId("milkdown-editor")).toHaveValue("上传中的正文");
 });

});
