import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/components/layout/page-route-fallback", () => ({
  PageRouteFallback: ({ variant }: { variant: string }) => (
    <div data-variant={variant}>页面加载骨架</div>
  ),
}));

import Loading from "@/app/moments/[id]/loading";

describe("MomentDetailLoading", () => {
  test("路由切换期间使用详情骨架替换中栏内容", () => {
    render(<Loading />);
    expect(screen.getByText("页面加载骨架")).toHaveAttribute("data-variant", "detail");
  });
});
