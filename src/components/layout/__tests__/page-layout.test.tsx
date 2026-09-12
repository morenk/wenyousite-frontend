import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

afterEach(cleanup);

describe("页面布局组件", () => {
  test("PageShell 默认使用 feed 语义宽度", () => {
    render(<PageShell>页面内容</PageShell>);
    expect(screen.getByText("页面内容")).toHaveClass("max-w-feed", "px-2");
  });

  test("PageShell 提供内容页语义宽度", () => {
    render(<PageShell width="content">内容页面</PageShell>);
    expect(screen.getByText("内容页面")).toHaveClass("max-w-content");
  });

  test("PageShell 提供动态详情语义宽度", () => {
    render(<PageShell width="moment">动态详情</PageShell>);
    expect(screen.getByText("动态详情")).toHaveClass("max-w-moment");
  });

  test("PageHeader 组合返回入口、说明和主动作", () => {
    render(
      <PageHeader
        title="标签页"
        description="主题帖标签"
        backHref="/"
        backLabel="返回发现"
        actions={<button type="button">创建</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "标签页" })).toHaveClass(
      "font-display", "[font-weight:var(--type-page-title-weight)]",
    );
    expect(screen.getByText("主题帖标签")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回发现" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "创建" })).toBeInTheDocument();
  });

  test("PageHeader 紧凑模式把标题和页面工具收进同一排头", () => {
    render(
      <PageHeader
        title="发现主题帖"
        variant="compact"
        toolbar={<button type="button">筛选</button>}
      />,
    );

    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-variant", "compact");
    expect(header).toHaveClass("rounded-2xl", "overflow-hidden");
    expect(screen.getByRole("heading", { name: "发现主题帖" })).toHaveClass(
      "font-display", "[font-weight:var(--type-section-title-weight)]",
      "[font-size:var(--type-section-title-size)]",
      "[line-height:var(--type-section-title-line-height)]",
    );
    expect(screen.getByRole("button", { name: "筛选" }).parentElement).toHaveAttribute(
      "data-slot",
      "page-header-toolbar",
    );
  });

  test.each(["default", "compact"] as const)("功能标题在 %s 模式使用body 半粗并保留标题尺寸", (variant) => {
    render(<PageHeader title="账号安全" purpose="functional" variant={variant} />);
    const heading = screen.getByRole("heading", { name: "账号安全" });
    const role = variant === "compact" ? "section" : "page";
    expect(heading).toHaveClass(
      "font-sans", "font-semibold",
      `[font-size:var(--type-${role}-title-size)]`,
      `[line-height:var(--type-${role}-title-line-height)]`,
    );
    expect(heading).not.toHaveClass("font-display");
    expect(heading).not.toHaveClass(`[font-weight:var(--type-${role}-title-weight)]`);
  });
});
