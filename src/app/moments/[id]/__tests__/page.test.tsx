import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockDetail,
  mockBack,
  mockReplace,
  mockTakeReturn,
} = vi.hoisted(() => ({
  mockDetail: vi.fn(),
  mockBack: vi.fn(),
  mockReplace: vi.fn(),
  mockTakeReturn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "moment-direct" }),
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));
vi.mock("@/lib/moment-navigation", () => ({
  takeMomentFeedReturn: (...args: unknown[]) => mockTakeReturn(...args),
}));
vi.mock("@/components/moment/moment-detail-view", () => ({
  MomentDetailView: (props: Record<string, unknown>) => {
    mockDetail(props);
    return (
      <article>
        动态详情正文
        <button type="button" onClick={() => (props.onDeleted as () => void)()}>
          模拟删除完成
        </button>
      </article>
    );
  },
}));
vi.mock("@/components/layout/page-shell", () => ({
  PageShell: ({ children, width, className }: {
    children: React.ReactNode;
    width?: string;
    className?: string;
  }) => (
    <main data-width={width} className={className}>{children}</main>
  ),
}));

import MomentDetailPage from "@/app/moments/[id]/page";

describe("MomentDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTakeReturn.mockReturnValue(false);
  });
  afterEach(cleanup);

  test("详情使用 36rem 语义宽度并保留统一返回入口", () => {
    const { container } = render(<MomentDetailPage />);

    expect(mockDetail).toHaveBeenCalledWith({
      momentId: "moment-direct",
      onDeleted: expect.any(Function),
    });
    expect(screen.getByRole("main")).toHaveAttribute("data-width", "feed");
    expect(screen.getByRole("main")).toHaveClass("py-5");
    expect(container.querySelector('[data-slot="moment-detail-column"]')).toHaveClass(
      "max-w-moment",
      "mx-auto",
    );
    expect(container.querySelector('[data-slot="moment-detail-toolbar"]')).toHaveClass("w-full");
    expect(container.querySelector('[data-slot="moment-detail-toolbar"]')).not.toHaveClass("max-w-[36rem]");
    expect(screen.getByRole("button", { name: "返回动态" })).toBeInTheDocument();
    expect(screen.getByText("动态详情正文")).toBeInTheDocument();
  });

  test("直接打开详情时返回发现流", () => {
    render(<MomentDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: "返回动态" }));

    expect(mockTakeReturn).toHaveBeenCalledWith("moment-direct");
    expect(mockReplace).toHaveBeenCalledWith("/moments");
    expect(mockBack).not.toHaveBeenCalled();
  });

  test("从动态流进入时，返回或删除后恢复原列表历史", () => {
    mockTakeReturn.mockReturnValue(true);
    const { rerender } = render(<MomentDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: "返回动态" }));
    expect(mockBack).toHaveBeenCalledOnce();
    expect(mockReplace).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mockTakeReturn.mockReturnValue(true);
    rerender(<MomentDetailPage />);
    fireEvent.click(screen.getByRole("button", { name: "模拟删除完成" }));
    expect(mockBack).toHaveBeenCalledOnce();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
