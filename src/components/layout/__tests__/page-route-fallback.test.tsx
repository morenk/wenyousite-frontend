import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PageRouteFallback } from "@/components/layout/page-route-fallback";

afterEach(cleanup);

describe("PageRouteFallback", () => {
  test.each(["feed", "detail", "profile"] as const)(
    "%s 变体保留统一加载语义与延迟进度线",
    (variant) => {
      const { container } = render(<PageRouteFallback variant={variant} />);

      expect(screen.getByRole("status", { name: "页面加载中" })).toBeInTheDocument();
      expect(container.querySelector('[data-slot="navigation-progress"]')).toBeInTheDocument();
      expect(container.querySelector('[data-slot="page-shell"]')).toBeInTheDocument();
      expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(5);
    },
  );

  test("资料页骨架的贴边封面和内容外框使用卡片圆角", () => {
    const { container } = render(<PageRouteFallback variant="profile" />);
    const panels = container.querySelectorAll('[data-slot="panel"]');
    expect(panels).toHaveLength(4);
    panels.forEach((panel) => expect(panel).toHaveClass("rounded-[var(--radius-card)]"));
    expect(panels[0]).toHaveClass("overflow-hidden");
    expect(panels[0].firstElementChild).toHaveClass("rounded-none");
  });
});
