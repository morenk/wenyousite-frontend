/** EmptyState 组件测试 */

import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EmptyState } from "@/components/shared/empty-state";

afterEach(() => cleanup());

describe("EmptyState", () => {
  test("渲染标题", () => {
    const { container } = render(<EmptyState title="暂无数据" />);
    expect(screen.getByText("暂无数据")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-feedback-state", "empty");
  });

  test("渲染描述", () => {
    render(<EmptyState title="暂无数据" description="这里是描述" />);
    expect(screen.getByText("这里是描述")).toBeInTheDocument();
  });

  test("无 description 时不渲染第二个 p 标签", () => {
    const { container } = render(<EmptyState title="只有标题" />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(1);
  });

  test("渲染图标", () => {
    const { container } = render(<EmptyState title="test" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
