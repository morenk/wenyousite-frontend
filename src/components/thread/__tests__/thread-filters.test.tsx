import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ThreadFilters } from "@/components/thread/thread-filters";

afterEach(cleanup);

describe("ThreadFilters", () => {
  test("展示全部排序和状态选项", async () => {
    const user = userEvent.setup();
    render(
      <ThreadFilters
        sort="recommended"
        onSortChange={() => {}}
        onStatusChange={() => {}}
      />,
    );

    expect(screen.getByRole("combobox", { name: "排序" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "状态" })).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "排序" }));
    expect(screen.getByRole("option", { name: "最新创建" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "最新回复" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "智能排序" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "智能排序" }));
    await user.click(screen.getByRole("combobox", { name: "状态" }));
    expect(screen.getByRole("option", { name: "全部状态" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "招募中" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "已停招" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "已结束" })).toBeInTheDocument();
  });

  test("切换排序和状态", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const onStatusChange = vi.fn();
    render(
      <ThreadFilters
        sort="recommended"
        onSortChange={onSortChange}
        onStatusChange={onStatusChange}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "排序" }));
    await user.click(screen.getByRole("option", { name: "最新回复" }));
    await user.click(screen.getByRole("combobox", { name: "状态" }));
    await user.click(screen.getByRole("option", { name: "已停招" }));

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

    expect(screen.getByRole("combobox", { name: "排序" })).toHaveTextContent("最新创建");
    expect(screen.getByRole("combobox", { name: "状态" })).toHaveTextContent("已结束");
  });

  test("选择全部状态时回传 undefined", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    render(
      <ThreadFilters
        sort="recommended"
        status="CLOSED"
        onSortChange={() => {}}
        onStatusChange={onStatusChange}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "状态" }));
    await user.click(screen.getByRole("option", { name: "全部状态" }));

    expect(onStatusChange).toHaveBeenCalledWith(undefined);
  });
});
