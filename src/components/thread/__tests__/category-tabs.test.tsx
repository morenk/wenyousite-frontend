/** CategoryTabs 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CategoryTabs } from "@/components/thread/category-tabs";

const { categoryState } = vi.hoisted(() => ({
  categoryState: {
    categories: [
      { id: "deduction", slug: "DEDUCTION", name: "演绎", color: null },
      { id: "nation", slug: "NATION", name: "国策", color: null },
      { id: "rpg", slug: "RPG", name: "RPG", color: null },
      { id: "mystery", slug: "MYSTERY", name: "悬疑" },
    ],
  },
}));

vi.mock("@/components/thread/thread-categories-provider", () => ({
  useThreadCategoriesContext: () => ({
    categories: categoryState.categories,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

afterEach(() => cleanup());

describe("CategoryTabs", () => {
  test("渲染全部和服务端返回的动态分类", () => {
    render(<CategoryTabs onChange={() => {}} />);
    expect(screen.getByRole("tablist", { name: "主题帖分类" })).toHaveClass(
      "overflow-y-hidden",
    );
    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("演绎")).toBeInTheDocument();
    expect(screen.getByText("国策")).toBeInTheDocument();
    expect(screen.getByText("RPG")).toBeInTheDocument();
    expect(screen.getByText("悬疑")).toBeInTheDocument();
  });

  test("默认选中'全部'（selected 为 undefined）", () => {
    render(<CategoryTabs onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "全部" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("已选中分类高亮", () => {
    render(<CategoryTabs selected="RPG" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "RPG" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "演绎" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  test("点击'全部'调用 onChange(undefined)", () => {
    const onChange = vi.fn();
    render(<CategoryTabs selected="RPG" onChange={onChange} />);
    fireEvent.click(screen.getByText("全部"));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  test("点击'演绎'调用 onChange('DEDUCTION')", () => {
    const onChange = vi.fn();
    render(<CategoryTabs onChange={onChange} />);
    fireEvent.click(screen.getByText("演绎"));
    expect(onChange).toHaveBeenCalledWith("DEDUCTION");
  });

  test("点击'国策'调用 onChange('NATION')", () => {
    const onChange = vi.fn();
    render(<CategoryTabs onChange={onChange} />);
    fireEvent.click(screen.getByText("国策"));
    expect(onChange).toHaveBeenCalledWith("NATION");
  });

  test("点击'RPG'调用 onChange('RPG')", () => {
    const onChange = vi.fn();
    render(<CategoryTabs onChange={onChange} />);
    fireEvent.click(screen.getByText("RPG"));
    expect(onChange).toHaveBeenCalledWith("RPG");
  });

  test("点击动态分类时回传稳定 slug", () => {
    const onChange = vi.fn();
    render(<CategoryTabs onChange={onChange} />);
    fireEvent.click(screen.getByText("悬疑"));
    expect(onChange).toHaveBeenCalledWith("MYSTERY");
  });

  test("selected 为 undefined 时'全部'高亮", () => {
    const onChange = vi.fn();
    render(<CategoryTabs selected={undefined} onChange={onChange} />);
    expect(screen.getByRole("tab", { name: "全部" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
