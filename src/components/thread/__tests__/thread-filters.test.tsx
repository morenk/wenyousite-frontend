import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ThreadFilters } from "@/components/thread/thread-filters";

afterEach(cleanup);

describe("ThreadFilters", () => {
  test("展示全部排序和状态选项", () => {
    render(
      <ThreadFilters
        sort="recommended"
        onSortChange={() => {}}
        onStatusChange={() => {}}
      />,
    );

    expect(screen.getByRole("combobox", { name: "排序" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "状态" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "最新创建" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "最新回复" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "智能排序" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "全部状态" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "招募中" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "已停招" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "已结束" })).toBeInTheDocument();
  });

  test("切换排序和状态", () => {
    const onSortChange = vi.fn();
    const onStatusChange = vi.fn();
    render(
      <ThreadFilters
        sort="recommended"
        onSortChange={onSortChange}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "排序" }), {
      target: { value: "active" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "状态" }), {
      target: { value: "CLOSED" },
    });

    expect(onSortChange).toHaveBeenCalledWith("active");
    expect(onStatusChange).toHaveBeenCalledWith("CLOSED");
  });

  test("显示当前选项", () => {
    render(
      <ThreadFilters
        sort="newest"
        status="FINISHED"
        onSortChange={() => {}}
        onStatusChange={() => {}}
      />,
    );

    expect(screen.getByRole("combobox", { name: "排序" })).toHaveValue("newest");
    expect(screen.getByRole("combobox", { name: "状态" })).toHaveValue("FINISHED");
  });

  test("选择全部状态时回传 undefined", () => {
    const onStatusChange = vi.fn();
    render(
      <ThreadFilters
        sort="recommended"
        status="CLOSED"
        onSortChange={() => {}}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "状态" }), {
      target: { value: "" },
    });

    expect(onStatusChange).toHaveBeenCalledWith(undefined);
  });
});
