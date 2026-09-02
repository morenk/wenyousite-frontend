import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminFilterBar, AdminFilterField, AdminPagination } from "./admin-list-controls";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";

describe("管理员列表分页", () => {
  it("保留上一页游标栈并在筛选范围变化时回到第一页", () => {
    const { result, rerender } = renderHook(
      ({ scope }) => useCursorPagination(scope),
      { initialProps: { scope: "status:OPEN" } },
    );

    act(() => result.current.next("cursor-1"));
    expect(result.current).toMatchObject({ cursor: "cursor-1", page: 2, hasPrevious: true });

    act(() => result.current.previous());
    expect(result.current).toMatchObject({ cursor: undefined, page: 1, hasPrevious: false });

    act(() => result.current.next("cursor-2"));
    rerender({ scope: "status:RESOLVED" });
    expect(result.current).toMatchObject({ cursor: undefined, page: 1, hasPrevious: false });
  });

  it("分页器明确禁用不可达方向并触发下一页", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(
      <AdminPagination
        page={1}
        pageSize={20}
        visibleCount={20}
        hasPrevious={false}
        hasNext
        onPrevious={vi.fn()}
        onNext={onNext}
      />,
    );

    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(screen.getByText("第 1 页 · 本页 20 条 · 每页 20 条")).toBeInTheDocument();
  });

  it("筛选摘要和完整字段分层呈现且字段不会被压窄", () => {
    const { container } = render(
      <AdminFilterBar activeCount={1} summary="当前页 20 条" onReset={vi.fn()}>
        <AdminFilterField label="关键词" className="w-64">
          <input aria-label="关键词输入" />
        </AdminFilterField>
      </AdminFilterBar>,
    );

    const bar = container.querySelector('[data-slot="admin-filter-bar"]');
    const fields = container.querySelector('[data-slot="admin-filter-fields"]');
    expect(bar).toContainElement(fields as HTMLElement);
    expect(fields).toHaveClass("mt-3", "flex-wrap");
    expect(screen.getByRole("group", { name: "关键词" })).toHaveClass("shrink-0", "w-64");
    expect(screen.getByText("当前页 20 条")).toBeInTheDocument();
  });
});
