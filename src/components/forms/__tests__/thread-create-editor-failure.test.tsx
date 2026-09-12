import { afterAll, afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Editor } from "@milkdown/core";
import { serializerCtx } from "@milkdown/core";
import { toast } from "sonner";
import { ThreadCreateForm } from "@/components/forms/thread-create-form";
import { EditorMarkdownCodecError } from "@/components/editor/milkdown-markdown-codec";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";

// 仅绕过 Next 动态加载；实际公开壳、宿主、Crepe 和 bridge 全部运行。
vi.mock("@/components/editor/milkdown-editor", async () =>
  import("@/components/editor/milkdown-editor-core"));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }));
const { save, meta, instance } = vi.hoisted(() => ({ save: vi.fn(), meta: { version: 5 }, instance: { editor: null as Editor | null } }));
vi.mock("@milkdown/crepe/builder", async (importOriginal) => {
  const original = await importOriginal<typeof import("@milkdown/crepe/builder")>();
  return { ...original, CrepeBuilder: class extends original.CrepeBuilder {
    constructor(...args: ConstructorParameters<typeof original.CrepeBuilder>) {
      super(...args);
      instance.editor = this.editor;
    }
  } };
});
vi.mock("@/api/hooks/use-api-meta", () => ({ useApiMeta: () => ({ data: { markdownContractVersion: meta.version } }) }));
vi.mock("@/api/hooks/use-save-thread-aggregate", () => ({
  useSaveThreadAggregate: () => ({ mutateAsync: save }),
}));
vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => { cleanup(); meta.version = 5; vi.restoreAllMocks(); vi.clearAllMocks(); });
afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3100)); });
function makeSub(id: string, title: string, sortOrder: number) {
  return {
    id,
    threadId: "t1",
    title,
    sortOrder,
    postingPolicy: "PARTICIPANTS" as const,
    postingCapability: { canPost: true, denialReason: null },
    version: 1,
    lastPostAt: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: null,
    _count: { posts: 0 },
  };
}

const mockThread: ThreadDetail = {
  id: "t1",
  title: "未命名草稿",
  ownerId: "u1",
  category: null,
  categoryInfo: null,
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: false,
  publishedAt: null,
  pinned: false,
  pinnedAt: null,
  viewCount: 0,
  version: 1,
  likeCount: 0,
  tipTotal: "0",
  defaultSubthreadId: "s1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "test", avatar: null, level: 1 },
  subthreads: [makeSub("s1", "主帖", 0)],
  defaultSubthread: makeSub("s1", "主帖", 0),
  topicTags: [],
  _count: { members: 1, players: 1, posts: 0 },
  isBookmarked: false,
  bookmarkId: null,
  isLiked: false,
};


test.each(["继续输入", "撤销"])("真实 bridge 编码失败保留新输入并阻断旧值提交，%s后恢复", async (recovery) => {
  let failSerialization = false;
  let failures = 0;
  instance.editor = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
  const thread: ThreadDetail = { ...mockThread, title: "稳定性回归", category: "MYSTERY",
    defaultSubthread: { ...mockThread.defaultSubthread, bodyPost: {
      id: "body-1", content: "A", version: 1, diceRolls: [],
    } as NonNullable<ThreadDetail["defaultSubthread"]["bodyPost"]> },
  };
  save.mockResolvedValue(thread);
  const user = userEvent.setup();
  const onCancel = vi.fn();
  const { container } = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ThreadCreateForm thread={thread} onCancel={onCancel} onPublished={vi.fn()} />
    </QueryClientProvider>,
  );
  const editor = await waitFor(() => {
    const element = container.querySelector<HTMLElement>(".ProseMirror");
    expect(element).toBeInTheDocument();
    return element!;
  });
  expect(editor.textContent).toBe("A");
  await user.click(screen.getByRole("button", { name: "保存草稿" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
    body: expect.objectContaining({ content: "A" }),
  })));
  save.mockClear();
  // A 已成功通过真实 bridge 保存；此后才包装 serializerCtx，排除挂载失败。
  instance.editor!.action((ctx) => {
    const serialize = ctx.get(serializerCtx);
    ctx.set(serializerCtx, (doc) => {
      if (failSerialization) {
        failures++;
        throw new EditorMarkdownCodecError("测试注入：正文编码失败");
      }
      return serialize(doc);
    });
  });
  failSerialization = true;
  await user.type(editor.querySelector("p")!, "B");
  expect(editor.textContent).toBe("AB");
  expect(failures).toBeGreaterThan(0);
  expect(toast.error).toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "保存草稿" }));
  await user.click(screen.getByRole("button", { name: "发布" }));
  expect(save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "放弃" }));
  expect(onCancel).not.toHaveBeenCalled();
  expect(editor.textContent).toBe("AB");

  failSerialization = false;
  if (recovery === "撤销") {
    await user.click(editor.querySelector("p")!);
    await user.keyboard("{Control>}z{/Control}");
  } else await user.type(editor.querySelector("p")!, "C");
  const expectedContent = recovery === "撤销" ? "A" : "ABC";
  expect(editor.textContent).toBe(expectedContent);
  await user.click(screen.getByRole("button", { name: "保存草稿" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
    body: expect.objectContaining({ content: expectedContent }),
  })));
  save.mockClear();
  await user.click(screen.getByRole("button", { name: "发布" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
    body: expect.objectContaining({ content: expectedContent, published: true }),
  })));
});


test.each([
  [5, "甲 [[widget:v9:future]]"],
  [5, "甲 <span>乙</span>"],
  [5, "[wenyousite-align-v9-center]: #\n甲"],
  [3, "[wenyousite-align-v1-center]: #\n甲"],
  [4, "[wenyousite-align-v1-right]: #\n![图](https://cdn.example.com/a.png)"],
  [6, "甲"],
])("版本 %s 不可安全编辑的原文不进入降级覆盖链路", async (version, content) => {
  meta.version = version;
  const thread = { ...mockThread, title: "兼容保护", category: "MYSTERY", defaultSubthread: {
    ...mockThread.defaultSubthread, bodyPost: { id: "body-1", content, version: 1, diceRolls: [] },
  } };
  const onCancel = vi.fn();
  const { container } = render(<QueryClientProvider client={new QueryClient()}>
    <ThreadCreateForm thread={thread} onCancel={onCancel} onPublished={vi.fn()} />
  </QueryClientProvider>);
  await screen.findByRole("alert");
  expect(container.querySelector("pre")?.textContent).toBe(content);
  expect(container.querySelector(".ProseMirror")).toBeNull();
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("给你的主题帖起个名字"), "新标题");
  await user.click(screen.getByRole("button", { name: "保存草稿" }));
  await user.click(screen.getByRole("button", { name: "发布" }));
  expect(save).not.toHaveBeenCalled();
  expect(container.querySelector("pre")?.textContent).toBe(content);
  await user.click(screen.getByRole("button", { name: "放弃" }));
  expect(onCancel).toHaveBeenCalledOnce();
});


test.each([
  ["network-error", new Error("network"), false],
  ["conflict", { code: 40002, message: "version conflict" }, true],
  ["unsupported", { code: 40009, message: "unsupported" }, false],
])("真实表单 %s 保留当前编辑，显式重试使用当前值和已读取版本", async (_name, error, conflict) => {
  let thread = { ...mockThread, title: "失败恢复", category: "MYSTERY", defaultSubthread: {
    ...mockThread.defaultSubthread, bodyPost: { id: "body-1", content: "正文甲", version: 1, diceRolls: [] },
  } };
  const client = new QueryClient();
  const form = () => <QueryClientProvider client={client}>
    <ThreadCreateForm thread={thread} onCancel={vi.fn()} onPublished={vi.fn()} />
  </QueryClientProvider>;
  const { container, rerender } = render(form());
  const editor = await waitFor(() => {
    const element = container.querySelector<HTMLElement>(".ProseMirror p");
    expect(element).toHaveTextContent("正文甲"); return element!;
  });
  const user = userEvent.setup();
  await user.type(editor, "乙");
  save.mockRejectedValueOnce(error);
  await user.click(screen.getByRole("button", { name: "保存草稿" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(editor.textContent).toBe("正文甲乙");
  expect(save).toHaveBeenCalledOnce();
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ body: expect.objectContaining({ content: "正文甲乙", bodyVersion: 1 }) }));
  if (conflict) {
    // 模拟用户载入当前服务器版本后保留本地内容，只有下一次显式保存使用新版本。
    thread = { ...thread, version: 2, defaultSubthread: { ...thread.defaultSubthread, version: 2,
      bodyPost: { ...thread.defaultSubthread.bodyPost, version: 2 },
    } };
    rerender(form());
    expect(save).toHaveBeenCalledOnce();
  }
  save.mockResolvedValueOnce(thread);
  await user.click(screen.getByRole("button", { name: "保存草稿" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ body: expect.objectContaining({ content: "正文甲乙", bodyVersion: conflict ? 2 : 1 }) }));
});

test("编码失败期间能力刷新不重建旧快照，恢复后按新能力提交当前文档", async () => {
  const thread = { ...mockThread, title: "能力刷新", category: "MYSTERY", defaultSubthread: {
    ...mockThread.defaultSubthread, bodyPost: { id: "body-1", content: "A", version: 1, diceRolls: [] },
  } };
  const client = new QueryClient();
  const form = () => <QueryClientProvider client={client}>
    <ThreadCreateForm thread={thread} onCancel={vi.fn()} onPublished={vi.fn()} />
  </QueryClientProvider>;
  const { container, rerender } = render(form());
  await waitFor(() => expect(container.querySelector(".ProseMirror p")).toHaveTextContent("A"));
  let failed = true;
  instance.editor!.action((ctx) => {
    const serialize = ctx.get(serializerCtx);
    ctx.set(serializerCtx, (doc) => { if (failed) throw new EditorMarkdownCodecError("synthetic"); return serialize(doc); });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  const user = userEvent.setup();
  await user.type(container.querySelector<HTMLElement>(".ProseMirror p")!, "B");
  meta.version = 3;
  rerender(form());
  expect(container.querySelector(".ProseMirror")?.textContent).toBe("AB");
  await user.click(screen.getByRole("button", { name: "保存草稿" }));
  expect(save).not.toHaveBeenCalled();
  failed = false;
  await user.type(container.querySelector<HTMLElement>(".ProseMirror p")!, "C");
  await waitFor(() => expect(container.querySelector(".ProseMirror")?.textContent).toBe("ABC"));
  save.mockResolvedValue(thread);
  await user.click(screen.getByRole("button", { name: "保存草稿" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ content: "ABC" }) })));
});
