import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const { mockDetail } = vi.hoisted(() => ({ mockDetail: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "moment-direct" }),
}));
vi.mock("@/components/moment/moment-detail-view", () => ({
  MomentDetailView: (props: Record<string, unknown>) => {
    mockDetail(props);
    return <article>动态详情正文</article>;
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
  test("直接路由把参数交给紧凑详情页", () => {
    render(<MomentDetailPage />);

    expect(mockDetail).toHaveBeenCalledWith({ momentId: "moment-direct" });
    expect(screen.getByRole("main")).toHaveAttribute("data-width", "feed");
    expect(screen.getByRole("main")).toHaveClass("py-5");
    expect(screen.getByText("动态详情正文")).toBeInTheDocument();
  });
});
