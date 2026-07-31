/** CategoryTabs 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CategoryTabs } from "@/components/thread/category-tabs";

afterEach(() => cleanup());

describe("CategoryTabs", () => {
  test("渲染所有 4 个选项", () => {
    render(<CategoryTabs onChange={() => {}} />);
    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("演绎")).toBeInTheDocument();
    expect(screen.getByText("国策")).toBeInTheDocument();
    expect(screen.getByText("RPG")).toBeInTheDocument();
  });

  test("默认选中'全部'（selected 为 undefined）", () => {
    render(<CategoryTabs onChange={() => {}} />);
    const allBtn = screen.getByText("全部");
    expect(allBtn.className).toContain("bg-background");
  });

  test("已选中分类高亮", () => {
    render(<CategoryTabs selected="RPG" onChange={() => {}} />);
    const rpgBtn = screen.getByText("RPG");
    expect(rpgBtn.className).toContain("bg-background");
    const deductBtn = screen.getByText("演绎");
    expect(deductBtn.className).toContain("text-muted-foreground");
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

  test("selected 为 undefined 时'全部'高亮", () => {
    const onChange = vi.fn();
    render(<CategoryTabs selected={undefined} onChange={onChange} />);
    const allBtn = screen.getByText("全部");
    expect(allBtn.className).toContain("bg-background");
  });
});
