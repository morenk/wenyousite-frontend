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

    expect(screen.getByRole("heading", { name: "标签页" })).toBeInTheDocument();
    expect(screen.getByText("主题帖标签")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回发现" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "创建" })).toBeInTheDocument();
  });
});
