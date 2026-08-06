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

    expect(screen.getByRole("button", { name: "最新创建" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最新回复" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "智能排序" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部状态" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "招募中" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已停招" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已结束" })).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "最新回复" }));
    fireEvent.click(screen.getByRole("button", { name: "已停招" }));

    expect(onSortChange).toHaveBeenCalledWith("active");
    expect(onStatusChange).toHaveBeenCalledWith("CLOSED");
  });

  test("标记当前选项", () => {
    render(
      <ThreadFilters
        sort="newest"
        status="FINISHED"
        onSortChange={() => {}}
        onStatusChange={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "最新创建" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "已结束" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
