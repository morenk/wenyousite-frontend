import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockUseAuth,
  mockUseMoment,
  mockUpdate,
  mockDelete,
  mockLike,
  mockBookmark,
  mockConfirm,
  mockPush,
  mockReplace,
  mockToastError,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseMoment: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockLike: vi.fn(),
  mockBookmark: vi.fn(),
  mockConfirm: vi.fn(),
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/moments/moment-1",
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/api/hooks/use-moments", () => ({
  useMoment: () => mockUseMoment(),
  useUpdateMoment: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useDeleteMoment: () => ({ mutateAsync: mockDelete, isPending: false }),
  useMomentLike: () => ({ mutateAsync: mockLike, isPending: false }),
  useMomentBookmark: () => ({ mutateAsync: mockBookmark, isPending: false }),
}));
vi.mock("@/components/ui/confirm-provider", () => ({ useConfirm: () => mockConfirm }));
vi.mock("@/components/moment/moment-comments", () => ({ MomentComments: () => <div>评论区</div> }));
vi.mock("@/components/admin/admin-content-moderation-dialog", () => ({
  AdminContentModerationDialog: ({ open, target }: { open: boolean; target: { id: string } }) => open ? <div>处置 {target.id}</div> : null,
}));
vi.mock("@/components/economy/wenyou-tip-button", () => ({ WenyouTipButton: () => <button>加油</button> }));
vi.mock("@/components/shared/gallery-lightbox", () => ({
  GalleryLightbox: ({
    images,
    index,
  }: {
    images: Array<{ alt: string }>;
    index: number;
  }) => <div>{images[index]?.alt} 大图</div>,
}));
vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

import { MomentDetailView } from "@/components/moment/moment-detail-view";

function clipboardData(text: string) {
  return { getData: (type: string) => type === "text/plain" ? text : "" };
}

function selectEditorContents(editor: HTMLElement) {
  editor.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

const detail = {
  id: "moment-1",
  authorId: "author-1",
  author: { id: "author-1", username: "作者", avatar: null },
  title: "原动态标题",
  content: "原正文",
  contentExcerpt: "原正文",
  coverType: "TEXT" as const,
  textCoverTheme: "ROSE" as const,
  coverMedia: null,
  imageCount: 0,
  images: [],
  version: 1,
  canEdit: true,
  canDelete: true,
  viewerLiked: false,
  viewerBookmarked: false,
  likeCount: 0,
  bookmarkCount: 0,
  tipTotal: "8",
  createdAt: "2026-08-08T12:00:00.000Z",
};

describe("MomentDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "author-1" } });
    mockUseMoment.mockReturnValue({ data: detail, isLoading: false, isError: false, refetch: vi.fn() });
    mockUpdate.mockResolvedValue({ ...detail, title: "新动态标题", version: 2 });
    mockDelete.mockResolvedValue({});
    mockLike.mockResolvedValue({});
    mockBookmark.mockResolvedValue({});
    mockConfirm.mockResolvedValue(true);
  });
  afterEach(cleanup);

  test("作者可以编辑普通文本并删除动态", async () => {
    const { container } = render(<MomentDetailView momentId="moment-1" />);
    expect(container.querySelector("article")).toHaveClass("w-full", "bg-background");
    expect(container.querySelector("article")).not.toHaveClass("max-w-[36rem]");
    const titleCard = container.querySelector('[data-slot="moment-detail-title-card"]');
    expect(titleCard).toHaveClass(
      "w-full",
      "sm:px-7",
    );
    expect(titleCard).toContainElement(screen.getByRole("heading", { name: "原动态标题" }));
    expect(titleCard).toContainElement(screen.getByRole("button", { name: "编辑动态" }));
    expect(titleCard).toContainElement(screen.getByRole("button", { name: "删除动态" }));
    expect(container.querySelector('[data-slot="moment-detail-reading"]')).toHaveClass(
      "w-full",
      "sm:px-7",
    );
    expect(container.querySelector('[data-slot="moment-detail-reading"]')).not.toHaveClass("max-w-moment");
    fireEvent.click(screen.getByRole("button", { name: "编辑动态" }));
    fireEvent.change(screen.getByRole("textbox", { name: "动态标题" }), { target: { value: "新动态标题" } });
    const contentEditor = screen.getByRole("textbox", { name: "动态正文" });
    selectEditorContents(contentEditor);
    fireEvent.paste(contentEditor, { clipboardData: clipboardData("新正文") });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({
      id: "moment-1",
      body: { title: "新动态标题", content: "新正文", version: 1 },
    }));

    fireEvent.click(screen.getByRole("button", { name: "删除动态" }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("moment-1"));
    expect(mockReplace).toHaveBeenCalledWith("/moments");
  });

  test("管理员在动态详情可直接打开站务隐藏面板", () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-1", role: "ADMIN" } });
    mockUseMoment.mockReturnValue({
      data: { ...detail, canEdit: false, canDelete: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<MomentDetailView momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "站务隐藏动态" }));
    expect(screen.getByText("处置 moment-1")).toBeInTheDocument();
  });

  test("详情单图限制首屏高度并保留原始尺寸信息", () => {
    mockUseMoment.mockReturnValue({
      data: {
        ...detail,
        images: [{
          id: "image-1",
          url: "https://cdn.example.com/portrait.webp",
          mediumUrl: "https://cdn.example.com/portrait-md.webp",
          width: 1280,
          height: 1920,
        }],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { container } = render(<MomentDetailView momentId="moment-1" />);

    const image = screen.getByAltText("原动态标题，第 1 张图片");
    expect(image).toHaveAttribute("src", "https://cdn.example.com/portrait-md.webp");
    expect(image).toHaveAttribute("width", "1280");
    expect(image).toHaveAttribute("height", "1920");
    expect(image.closest('[data-slot="moment-detail-image"]')).toHaveClass(
      "w-full",
      "max-h-[min(72vh,42rem)]",
    );
    expect(image.closest('[data-slot="moment-detail-carousel"]')).toHaveClass(
      "w-full",
    );
    expect(image.closest('[data-slot="moment-detail-carousel"]')).not.toHaveClass("-mx-2");
    const titleCard = container.querySelector('[data-slot="moment-detail-title-card"]');
    const carousel = container.querySelector('[data-slot="moment-detail-carousel"]');
    expect(titleCard?.querySelector("h1")).toHaveTextContent("原动态标题");
    expect(titleCard?.compareDocumentPosition(carousel as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByText("动态")).not.toBeInTheDocument();
  });

  test("详情多图使用可循环的左右箭头轮播而不是网格", () => {
    const images = [
      { id: "image-1", url: "https://cdn.example.com/1.webp", mediumUrl: "https://cdn.example.com/1-md.webp", thumbnailUrl: null, feedUrl: null, width: 1200, height: 1600 },
      { id: "image-2", url: "https://cdn.example.com/2.webp", mediumUrl: "https://cdn.example.com/2-md.webp", thumbnailUrl: null, feedUrl: null, width: 1600, height: 1000 },
      { id: "image-3", url: "https://cdn.example.com/3.webp", mediumUrl: "https://cdn.example.com/3-md.webp", thumbnailUrl: null, feedUrl: null, width: 1000, height: 1000 },
    ];
    mockUseMoment.mockReturnValue({
      data: {
        ...detail,
        coverType: "IMAGE",
        coverMedia: images[2],
        imageCount: images.length,
        images,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { container } = render(<MomentDetailView momentId="moment-1" />);
    const carousel = container.querySelector('[data-slot="moment-detail-carousel"]');
    expect(carousel).not.toHaveClass("grid", "grid-cols-2");
    expect(screen.getByAltText("原动态标题，第 1 张图片")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一张图片" })).toHaveClass("z-10", "-mt-4");
    expect(screen.getByRole("button", { name: "下一张图片" })).toHaveClass("z-10", "-mt-4");
    expect(screen.getByAltText("原动态标题，第 1 张图片").closest('[data-slot="moment-detail-image"]')).toHaveStyle({ aspectRatio: "1" });

    fireEvent.click(screen.getByRole("button", { name: "下一张图片" }));
    const secondImage = screen.getByAltText("原动态标题，第 2 张图片");
    expect(secondImage).toHaveAttribute("src", "https://cdn.example.com/2-md.webp");
    expect(secondImage.closest('[data-slot="moment-detail-image"]')).toHaveStyle({ aspectRatio: "1" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "上一张图片" }));
    fireEvent.click(screen.getByRole("button", { name: "上一张图片" }));
    expect(screen.getByAltText("原动态标题，第 3 张图片")).toBeInTheDocument();
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  test("访客点赞与收藏会先登录", () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseMoment.mockReturnValue({
      data: { ...detail, canEdit: false, canDelete: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<MomentDetailView momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "点赞" }));
    fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    expect(mockPush).toHaveBeenCalledWith("/login?next=%2Fmoments%2Fmoment-1");
    expect(mockLike).not.toHaveBeenCalled();
  });

  test("已点赞状态与主题帖统一使用红色语义色", () => {
    mockUseAuth.mockReturnValue({ user: { id: "viewer-1" } });
    mockUseMoment.mockReturnValue({
      data: { ...detail, viewerLiked: true, likeCount: 6 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<MomentDetailView momentId="moment-1" />);

    expect(screen.getByRole("button", { name: "取消点赞，6" }))
      .toHaveClass("text-destructive", "bg-destructive-soft");
  });

  test("动态正文将命名站内坐标渲染为同页传送门", () => {
    const threadId = "cmsewdo0h000x7qv6aa77ll1v";
    mockUseMoment.mockReturnValue({
      data: { ...detail, content: `[角色设定](/threads/${threadId})` },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<MomentDetailView momentId="moment-1" />);

    expect(screen.getByRole("link", { name: "站内传送门：角色设定" })).toHaveAttribute(
      "href",
      `/threads/${threadId}`,
    );
  });

  test("加载与不可见状态有清晰反馈", () => {
    mockUseMoment.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { rerender } = render(<MomentDetailView momentId="moment-1" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    mockUseMoment.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    rerender(<MomentDetailView momentId="moment-1" />);
    expect(screen.getByText("动态不存在")).toBeInTheDocument();
  });

  test("删除需确认，成功后由详情页统一执行返回", async () => {
    mockConfirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const onDeleted = vi.fn();
    render(<MomentDetailView momentId="moment-1" onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole("button", { name: "删除动态" }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledOnce());
    expect(mockDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "删除动态" }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("moment-1"));
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test("编辑边界在客户端拦截，接口失败时保持编辑态供重试", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("version conflict"));
    render(<MomentDetailView momentId="moment-1" />);
    fireEvent.click(screen.getByRole("button", { name: "编辑动态" }));

    fireEvent.change(screen.getByRole("textbox", { name: "动态标题" }), {
      target: { value: "一" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith("标题需要 2～40 个字");

    fireEvent.change(screen.getByRole("textbox", { name: "动态标题" }), {
      target: { value: "合法标题" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledOnce());
    expect(mockToastError).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("textbox", { name: "动态标题" })).toHaveValue("合法标题");
  });

  test("登录用户可点赞收藏，点击详情图打开原图", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "viewer-1" } });
    mockUseMoment.mockReturnValue({
      data: {
        ...detail,
        canEdit: false,
        canDelete: false,
        images: [{
          id: "image-1",
          url: "https://cdn.example.com/original.webp",
          mediumUrl: "https://cdn.example.com/medium.webp",
          width: null,
          height: null,
        }],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<MomentDetailView momentId="moment-1" />);

    fireEvent.click(screen.getByRole("button", { name: "点赞" }));
    fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    await waitFor(() => expect(mockLike).toHaveBeenCalledOnce());
    expect(mockBookmark).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "查看大图：原动态标题，第 1 张图片" }));
    expect(await screen.findByText("原动态标题，第 1 张图片 大图")).toBeInTheDocument();
  });
});
