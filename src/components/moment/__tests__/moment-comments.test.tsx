import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockUseAuth,
  mockCreate,
  mockDelete,
  mockPush,
  mockSearchParams,
  mockFetchReplies,
  mockRefetchComments,
  mockRefetchContext,
  mockUseMomentCommentContext,
  mockUseMomentComments,
  mockUseMomentReplies,
  mockCompress,
  mockUpload,
  mockValidate,
  mockFetchComments,
  mockToastError,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
  mockPush: vi.fn(),
  mockSearchParams: vi.fn(),
  mockFetchReplies: vi.fn(),
  mockRefetchComments: vi.fn(),
  mockRefetchContext: vi.fn(),
  mockUseMomentCommentContext: vi.fn(),
  mockUseMomentComments: vi.fn(),
  mockUseMomentReplies: vi.fn(),
  mockCompress: vi.fn(),
  mockUpload: vi.fn(),
  mockValidate: vi.fn(),
  mockFetchComments: vi.fn(),
  mockToastError: vi.fn(),
}));

const reply = {
  id: "reply-1",
  momentId: "moment-1",
  author: { id: "user-2", username: "回复者", avatar: null },
  content: "楼中楼内容",
  media: null,
  sticker: null,
  parentCommentId: "root-1",
  replyToComment: null,
  deleted: false,
  canDelete: false,
  createdAt: "2026-08-08T12:01:00.000Z",
};
const root = {
  id: "root-1",
  momentId: "moment-1",
  author: { id: "user-1", username: "主评论者", avatar: null },
  content: "主评论内容",
  media: null,
  sticker: null,
  parentCommentId: null,
  replyToComment: null,
  deleted: false,
  canDelete: true,
  createdAt: "2026-08-08T12:00:00.000Z",
  replyCount: 2,
  replies: [reply],
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/moments/moment-1",
  useSearchParams: () => mockSearchParams(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/lib/moment-image", () => ({
  validateMomentImageFile: (...args: unknown[]) => mockValidate(...args),
  compressMomentImage: (...args: unknown[]) => mockCompress(...args),
}));
vi.mock("@/lib/upload-image", () => ({
  uploadImageFile: (...args: unknown[]) => mockUpload(...args),
  isUploadAbortError: (error: unknown) => error instanceof DOMException && error.name === "AbortError",
}));
vi.mock("@/components/sticker/sticker-picker-popover", () => ({
  StickerPickerPopover: ({ onSelect, disabled }: {
    onSelect: (sticker: Record<string, unknown>) => unknown;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect({
        id: "favorite-1",
        asset: {
          id: "sticker-1",
          url: "https://cdn.example.com/sticker.webp",
          thumbnailUrl: "https://cdn.example.com/sticker-thumb.webp",
          animated: true,
        },
      })}
    >
      选择测试表情包
    </button>
  ),
}));
vi.mock("@/api/hooks/use-moments", () => ({
  useMomentCommentContext: (...args: unknown[]) => mockUseMomentCommentContext(...args),
  useMomentComments: (...args: unknown[]) => mockUseMomentComments(...args),
  useMomentReplies: (...args: unknown[]) => mockUseMomentReplies(...args),
  useCreateMomentComment: () => ({ mutateAsync: mockCreate, isPending: false }),
  useDeleteMomentComment: () => ({ mutateAsync: mockDelete, isPending: false }),
}));
vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

import { MomentComments } from "@/components/moment/moment-comments";

const rect = (overrides: Partial<DOMRect> = {}) => ({
  x: 0,
  y: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
  ...overrides,
}) as DOMRect;

function clipboardData(text: string) {
  return { getData: (type: string) => type === "text/plain" ? text : "" };
}

describe("MomentComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.slot === "floating-moment-comment-anchor") {
        return rect({ x: 320, left: 320, right: 832, width: 512 });
      }
      if (this.dataset.slot === "floating-moment-comment-dock") {
        return rect({ height: 72, bottom: 72 });
      }
      return rect();
    });
    mockUseAuth.mockReturnValue({ user: { id: "viewer-1" } });
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockUseMomentCommentContext.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isError: false,
      refetch: mockRefetchContext,
    });
    mockUseMomentReplies.mockImplementation(
      (_momentId: string, _commentId: string, _userId: string, enabled: boolean) => ({
        data: enabled ? { pages: [{ data: [reply] }] } : undefined,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: mockFetchReplies,
      }),
    );
    mockCreate.mockResolvedValue({ id: "comment-new" });
    mockDelete.mockResolvedValue({});
    mockCompress.mockImplementation(async (file: File) => new File(
      [file],
      "comment.webp",
      { type: "image/webp" },
    ));
    mockUpload.mockResolvedValue({ mediaId: "media-1", url: "https://cdn.example.com/comment.webp" });
    mockValidate.mockReturnValue(null);
    mockUseMomentComments.mockReturnValue({
      data: { pages: [{ data: [root] }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchComments,
      refetch: mockRefetchComments,
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("展示两层评论、回复任意评论并删除有权限的评论", async () => {
    render(<MomentComments momentId="moment-1" />);
    expect(screen.queryByRole("heading", { name: "评论" })).toBeNull();
    expect(screen.queryByText("楼中楼")).toBeNull();
    expect(screen.getByText("主评论内容")).toHaveClass("text-base", "leading-7");
    expect(screen.getByText("楼中楼内容")).toHaveClass("text-base", "leading-7");

    const replyButtons = screen.getAllByRole("button", { name: "回复" });
    expect(replyButtons[0]).not.toHaveTextContent("回复");
    expect(replyButtons[0].querySelector("svg")).toHaveAttribute(
      "data-icon-semantic",
      "action.reply",
    );
    expect(replyButtons[0]).toHaveClass(
      "size-8",
      "hover:bg-primary",
      "hover:text-brand-strong",
    );
    const deleteButton = screen.getByRole("button", { name: "删除" });
    expect(deleteButton).not.toHaveTextContent("删除");
    expect(deleteButton).toHaveClass(
      "size-8",
      "hover:bg-primary",
      "hover:text-brand-strong",
    );
    fireEvent.click(replyButtons[1]);
    const editor = await screen.findByPlaceholderText("回复 回复者");
    fireEvent.paste(editor, { clipboardData: clipboardData("继续回复") });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      content: "继续回复",
      replyToCommentId: "reply-1",
    })));

    fireEvent.click(deleteButton);
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("root-1"));
    fireEvent.click(screen.getByRole("button", { name: "展开全部 2 条回复" }));
    expect(screen.getByText("楼中楼内容")).toBeInTheDocument();
  });

  test("通知目标会自动展开楼中楼、定位并高亮具体回复", async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams("comment=root-1&reply=reply-1"),
    );
    mockUseMomentCommentContext.mockReturnValue({
      data: { root, target: reply, replyCount: root.replyCount },
      error: null,
      isLoading: false,
      isError: false,
      refetch: mockRefetchContext,
    });
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});

    const { container } = render(<MomentComments momentId="moment-1" />);

    const target = container.querySelector("#moment-comment-reply-1");
    expect(target).toHaveAttribute("aria-current", "location");
    expect(mockUseMomentReplies).toHaveBeenLastCalledWith(
      "moment-1",
      "root-1",
      "viewer-1",
      true,
      { order: "NEWEST" },
    );
    expect(mockUseMomentCommentContext).toHaveBeenLastCalledWith(
      "moment-1",
      "reply-1",
      "viewer-1",
    );
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "center",
    }));
  });

  test("通知目标不在首批主评论时直接注入且不扫描后续分页", async () => {
    const laterRoot = {
      ...root,
      id: "root-later",
      content: "后页主评论",
      replyCount: 0,
      replies: [],
    };
    mockSearchParams.mockReturnValue(new URLSearchParams("comment=root-later"));
    mockUseMomentCommentContext.mockReturnValue({
      data: { root: laterRoot, target: laterRoot, replyCount: 0 },
      error: null,
      isLoading: false,
      isError: false,
      refetch: mockRefetchContext,
    });
    mockUseMomentComments.mockReturnValue({
      data: { pages: [{ data: [root] }] },
      isLoading: false,
      isError: false,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchComments,
      refetch: mockRefetchComments,
    });

    const { container } = render(<MomentComments momentId="moment-1" />);

    expect(screen.getByText("后页主评论")).toBeInTheDocument();
    expect(container.querySelector("#moment-comment-root-later")).toHaveAttribute(
      "aria-current",
      "location",
    );
    expect(mockFetchComments).not.toHaveBeenCalled();
  });

  test("通知目标不在首批楼中楼时直接注入、去重且不扫描回复分页", () => {
    const laterReply = {
      ...reply,
      id: "reply-later",
      content: "后页楼中楼",
    };
    mockSearchParams.mockReturnValue(
      new URLSearchParams("comment=root-1&reply=reply-later"),
    );
    mockUseMomentCommentContext.mockReturnValue({
      data: { root, target: laterReply, replyCount: root.replyCount },
      error: null,
      isLoading: false,
      isError: false,
      refetch: mockRefetchContext,
    });
    mockUseMomentReplies.mockReturnValue({
      data: { pages: [{ data: [reply] }] },
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchReplies,
    });

    const { container } = render(<MomentComments momentId="moment-1" />);

    expect(screen.getAllByText("后页楼中楼")).toHaveLength(1);
    expect(container.querySelector("#moment-comment-reply-later")).toHaveAttribute(
      "aria-current",
      "location",
    );
    expect(mockFetchReplies).not.toHaveBeenCalled();
  });

  test("定位中显示进度，目标不可见时保留普通评论并明确提示", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("comment=hidden-comment"));
    mockUseMomentCommentContext.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      isError: false,
      refetch: mockRefetchContext,
    });
    const { rerender } = render(<MomentComments momentId="moment-1" />);
    expect(screen.getByText("正在定位目标回复…")).toBeInTheDocument();

    mockUseMomentCommentContext.mockReturnValue({
      data: undefined,
      error: { code: 40400, message: "目标评论不存在或不可见" },
      isLoading: false,
      isError: true,
      refetch: mockRefetchContext,
    });
    rerender(<MomentComments momentId="moment-1" />);

    expect(screen.getByText("目标回复不存在或不可见")).toBeInTheDocument();
    expect(screen.getByText("主评论内容")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试定位" })).toBeNull();
  });

  test("定位临时失败时保留评论并允许重试", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("comment=target-comment"));
    mockUseMomentCommentContext.mockReturnValue({
      data: undefined,
      error: { code: 50000, message: "服务暂时不可用" },
      isLoading: false,
      isError: true,
      refetch: mockRefetchContext,
    });

    render(<MomentComments momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "重试定位" }));

    expect(mockRefetchContext).toHaveBeenCalledOnce();
    expect(screen.getByText("主评论内容")).toBeInTheDocument();
  });

  test("超过十条的已展开楼中楼提供悬浮收起按钮", async () => {
    const largeThread = { ...root, replyCount: 108 };
    mockUseMomentComments.mockReturnValue({
      data: { pages: [{ data: [largeThread] }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchComments,
      refetch: mockRefetchComments,
    });
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});

    render(<MomentComments momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "展开全部 108 条回复" }));

    const collapse = screen.getByRole("button", { name: "收起 108 条回复" });
    expect(collapse.closest('[data-slot="moment-replies-collapse-dock"]')).toHaveClass(
      "sticky",
      "top-4",
    );

    fireEvent.click(collapse);
    expect(screen.getByRole("button", { name: "展开全部 108 条回复" })).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    }));
  });

  test("访客看到登录入口并保留当前动态返回地址", () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<MomentComments momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "登录后发表评论" }));
    expect(mockPush).toHaveBeenCalledWith("/login?next=%2Fmoments%2Fmoment-1");
  });

  test("只用按钮切换正倒序，不显示回复者筛选", async () => {
    render(<MomentComments momentId="moment-1" />);
    expect(screen.queryByRole("combobox")).toBeNull();

    const sortToggle = screen.getByRole("button", { name: "评论排序" });
    expect(sortToggle).toHaveTextContent("最新在前");
    fireEvent.click(sortToggle);

    await waitFor(() => expect(mockUseMomentComments).toHaveBeenLastCalledWith(
      "moment-1",
      "viewer-1",
      { order: "OLDEST" },
    ));
    expect(screen.getByRole("button", { name: "评论排序" })).toHaveTextContent("最早在前");
  });

  test("评论框固定在内容列底部，回复深处评论时聚焦但不滚动页面", async () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    render(<MomentComments momentId="moment-1" />);

    const collapsed = screen.getByRole("button", { name: "发表评论…" });
    const dock = collapsed.closest<HTMLElement>('[data-slot="floating-moment-comment-dock"]');
    expect(dock).toHaveClass("fixed", "bottom-4", "z-[var(--layer-floating)]");
    expect(dock).toHaveStyle({ left: "320px", width: "512px" });
    expect(dock?.parentElement).toBe(document.body);

    fireEvent.click(screen.getAllByRole("button", { name: "回复" })[1]);

    expect(await screen.findByPlaceholderText("回复 回复者")).toBeInTheDocument();
    await waitFor(() => expect(focus).toHaveBeenLastCalledWith({ preventScroll: true }));
  });

  test("一条评论上传一张前端压缩后的图片，允许不填写文字", async () => {
    render(<MomentComments momentId="moment-1" />);
    const original = new File(["image"], "camera.jpg", { type: "image/jpeg" });

    fireEvent.click(screen.getByRole("button", { name: "发表评论…" }));
    fireEvent.change(screen.getByLabelText("上传评论图片"), {
      target: { files: [original] },
    });
    expect(screen.getByAltText("待发送评论图片")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      content: "",
      mediaId: "media-1",
    })));
    expect(mockCreate.mock.calls.at(-1)?.[0]).not.toHaveProperty("stickerAssetId");
    expect(mockCompress).toHaveBeenCalledWith(original, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(mockUpload).toHaveBeenCalledWith(
      expect.objectContaining({ name: "comment.webp", type: "image/webp" }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test("图片压缩上传中仍可从预览移除并取消发送", async () => {
    mockCompress.mockImplementation((_file: File, options: { signal: AbortSignal }) => new Promise(
      (_resolve, reject) => options.signal.addEventListener(
        "abort",
        () => reject(new DOMException("已取消", "AbortError")),
        { once: true },
      ),
    ));
    render(<MomentComments momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "发表评论…" }));
    fireEvent.change(screen.getByLabelText("上传评论图片"), {
      target: { files: [new File(["image"], "camera.jpg", { type: "image/jpeg" })] },
    });

    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await screen.findByRole("button", { name: "正在压缩" });
    fireEvent.click(screen.getByRole("button", { name: "移除评论图片" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "发送" })).toBeEnabled());
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("表情包会替换已选图片，并可作为无文字评论发送", async () => {
    render(<MomentComments momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "发表评论…" }));
    fireEvent.change(screen.getByLabelText("上传评论图片"), {
      target: { files: [new File(["image"], "camera.jpg", { type: "image/jpeg" })] },
    });
    expect(screen.getByAltText("待发送评论图片")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "选择测试表情包" }));
    expect(screen.queryByAltText("待发送评论图片")).toBeNull();
    expect(screen.getByAltText("待发送表情包")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      content: "",
      stickerAssetId: "sticker-1",
    })));
    expect(mockCreate.mock.calls.at(-1)?.[0]).not.toHaveProperty("mediaId");
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test("展示评论图片和表情包，但删除评论不展示媒体", () => {
    mockUseMomentComments.mockReturnValue({
      data: {
        pages: [{
          data: [
            {
              ...root,
              media: {
                id: "media-1",
                url: "https://cdn.example.com/comment.webp",
                mediumUrl: "https://cdn.example.com/comment-md.webp",
              },
            },
            {
              ...root,
              id: "root-sticker",
              content: "",
              sticker: {
                id: "sticker-1",
                url: "https://cdn.example.com/sticker.webp",
                thumbnailUrl: "https://cdn.example.com/sticker-thumb.webp",
                mediumUrl: "https://cdn.example.com/sticker.webp",
                animated: false,
              },
            },
            {
              ...root,
              id: "root-deleted",
              content: null,
              media: null,
              deleted: true,
            },
          ],
        }],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchComments,
      refetch: mockRefetchComments,
    });

    render(<MomentComments momentId="moment-1" />);

    expect(screen.getByAltText("评论图片")).toHaveAttribute(
      "src",
      "https://cdn.example.com/comment-md.webp",
    );
    expect(screen.getByAltText("评论表情包")).toHaveAttribute(
      "src",
      "https://cdn.example.com/sticker-thumb.webp",
    );
    expect(screen.getByAltText("评论表情包")).toHaveClass("sticker-display");
    expect(screen.getByAltText("评论表情包").getAttribute("style")).toContain(
      "--sticker-display-max",
    );
    expect(screen.getByText("该评论已删除")).toBeInTheDocument();
  });

  test("评论加载、失败、空态与主评论翻页都可恢复操作", () => {
    mockUseMomentComments.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchComments,
      refetch: mockRefetchComments,
    });
    const { rerender } = render(<MomentComments momentId="moment-1" />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    mockUseMomentComments.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchComments,
      refetch: mockRefetchComments,
    });
    rerender(<MomentComments momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(mockRefetchComments).toHaveBeenCalledOnce();

    mockUseMomentComments.mockReturnValue({
      data: { pages: [{ data: [] }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchComments,
      refetch: mockRefetchComments,
    });
    rerender(<MomentComments momentId="moment-1" />);
    expect(screen.getByText("还没有评论")).toBeInTheDocument();

    mockUseMomentComments.mockReturnValue({
      data: { pages: [{ data: [root] }] },
      isLoading: false,
      isError: false,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchComments,
      refetch: mockRefetchComments,
    });
    rerender(<MomentComments momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "加载更多评论" }));
    expect(mockFetchComments).toHaveBeenCalledOnce();
  });

  test("空评论在客户端拦截，选择无效图片也不会进入预览", async () => {
    render(<MomentComments momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "发表评论…" }));
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(await screen.findByText("请输入评论或选择一张图片/表情包")).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();

    mockValidate.mockReturnValueOnce("动态暂不支持动图");
    fireEvent.change(screen.getByLabelText("上传评论图片"), {
      target: { files: [new File(["gif"], "bad.gif", { type: "image/gif" })] },
    });
    expect(screen.queryByAltText("待发送评论图片")).toBeNull();
    expect(mockToastError).toHaveBeenCalledWith("动态暂不支持动图");
  });

  test("图片评论发送失败后复用已上传媒体与同一个幂等请求 ID", async () => {
    mockCreate
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ id: "comment-new" });
    render(<MomentComments momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "发表评论…" }));
    fireEvent.change(screen.getByLabelText("上传评论图片"), {
      target: { files: [new File(["image"], "camera.jpg", { type: "image/jpeg" })] },
    });

    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "发送" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));

    expect(mockCompress).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[1][0]).toMatchObject({
      mediaId: "media-1",
      clientRequestId: mockCreate.mock.calls[0][0].clientRequestId,
    });
    expect(mockToastError).toHaveBeenCalled();
  });

  test("图片上传中断后重试复用同一份压缩文件", async () => {
    mockUpload
      .mockRejectedValueOnce(new Error("upload interrupted"))
      .mockResolvedValueOnce({ mediaId: "media-1", url: "https://cdn.example.com/comment.webp" });
    render(<MomentComments momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "发表评论…" }));
    fireEvent.change(screen.getByLabelText("上传评论图片"), {
      target: { files: [new File(["image"], "camera.jpg", { type: "image/jpeg" })] },
    });

    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      mediaId: "media-1",
    })));
    expect(mockCompress).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  test("删除失败保留评论并给出反馈", async () => {
    mockDelete.mockRejectedValueOnce(new Error("forbidden"));
    render(<MomentComments momentId="moment-1" />);

    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(screen.getByText("主评论内容")).toBeInTheDocument();
  });
});
