import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AdminTable,
  AdminTableActionCell,
  AdminTableActionHeader,
  AdminTableBody,
  AdminTableHead,
  AdminTableRow,
} from "./admin-table";

describe("管理员数据表", () => {
  it("宽表格在自身容器滚动并保持操作列固定在右侧", () => {
    const { container } = render(
      <AdminTable aria-label="测试登记册" className="min-w-[56rem]">
        <AdminTableHead>
          <tr><AdminTableActionHeader>操作</AdminTableActionHeader></tr>
        </AdminTableHead>
        <AdminTableBody>
          <AdminTableRow data-selected="true">
            <AdminTableActionCell><button type="button">处理</button></AdminTableActionCell>
          </AdminTableRow>
        </AdminTableBody>
      </AdminTable>,
    );

    expect(container.querySelector('[data-slot="admin-table-scroll"]'))
      .toHaveClass("max-w-full", "overflow-x-auto");
    expect(screen.getByRole("table", { name: "测试登记册" }))
      .toHaveClass("min-w-[56rem]");
    expect(screen.getByRole("columnheader", { name: "操作" }))
      .toHaveClass("sticky", "right-0", "min-w-24");
    expect(screen.getByRole("cell", { name: "处理" }))
      .toHaveClass("sticky", "right-0", "bg-card");
  });
});
