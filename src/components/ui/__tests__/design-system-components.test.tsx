import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { StackList, StackListRow } from "@/components/ui/stack-list";

afterEach(cleanup);

describe("视觉系统基础组件", () => {
  test("Badge 通过语义 tone 暴露状态", () => {
    render(<Badge tone="success">招募中</Badge>);

    expect(screen.getByText("招募中")).toHaveAttribute("data-tone", "success");
    expect(screen.getByText("招募中")).toHaveClass("bg-success-soft");
  });

  test("Panel 通过 tone 和 padding 组合表面", () => {
    render(<Panel tone="soft" padding="compact">筛选条件</Panel>);

    expect(screen.getByText("筛选条件")).toHaveAttribute("data-tone", "soft");
    expect(screen.getByText("筛选条件")).toHaveClass("bg-muted", "p-4");
  });

  test("StackList 提供单一外框与列表行", () => {
    render(
      <StackList aria-label="测试列表">
        <StackListRow>第一行</StackListRow>
        <StackListRow>第二行</StackListRow>
      </StackList>,
    );

    expect(screen.getByLabelText("测试列表")).toHaveAttribute("data-slot", "stack-list");
    expect(screen.getByText("第一行")).toHaveAttribute("data-slot", "stack-list-row");
  });

  test("旧按钮尺寸映射到新的紧凑规格", () => {
    render(<Button size="sm">旧尺寸按钮</Button>);

    expect(screen.getByRole("button", { name: "旧尺寸按钮" })).toHaveClass("h-8");
  });
});
