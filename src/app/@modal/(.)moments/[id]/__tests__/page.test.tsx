import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockBack, mockDetail } = vi.hoisted(() => ({
  mockBack: vi.fn(),
  mockDetail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "moment-1" }),
  useRouter: () => ({ back: mockBack }),
}));
vi.mock("@/components/moment/moment-detail-view", () => ({
  MomentDetailView: (props: { onClose?: () => void }) => {
    mockDetail(props);
    return <article>动态正文<button type="button" onClick={props.onClose}>关闭详情</button></article>;
  },
}));

import MomentDetailModal from "@/app/@modal/(.)moments/[id]/page";

describe("MomentDetailModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("外层裁切完整圆角，滚动条在卡片内部独立滚动", () => {
    render(<MomentDetailModal />);

    const dialog = screen.getByRole("dialog", { name: "动态详情" });
    const shell = dialog.firstElementChild;
    const scroller = screen.getByText("动态正文").parentElement;
    expect(shell).toHaveClass("overflow-hidden", "rounded-3xl");
    expect(scroller).toHaveAttribute("data-slot", "moment-detail-scroll");
    expect(scroller).toHaveClass("moment-detail-scroll", "overflow-y-auto", "overscroll-contain");
  });

  test("只在遮罩或详情关闭按钮上后退，卡片内部点击不误关闭", () => {
    render(<MomentDetailModal />);
    const dialog = screen.getByRole("dialog", { name: "动态详情" });
    const shell = dialog.firstElementChild as HTMLElement;

    expect(mockDetail).toHaveBeenCalledWith(expect.objectContaining({
      momentId: "moment-1",
      modal: true,
      onClose: expect.any(Function),
    }));
    fireEvent.mouseDown(shell);
    expect(mockBack).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialog);
    expect(mockBack).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "关闭详情" }));
    expect(mockBack).toHaveBeenCalledTimes(2);
  });
});
