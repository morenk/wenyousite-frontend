import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  id: "admin-1",
  role: "SUPER_ADMIN" as "ADMIN" | "SUPER_ADMIN",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/station/taxonomy",
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/api/hooks/use-admin", () => ({
  useAdminSession: () => ({
    data: {
      user: { id: mocks.id, username: "站务员", role: mocks.role },
      session: {},
      csrfToken: "test",
    },
    isError: false,
    sessionStatus: "authenticated", generation: 0,
  }),
  useAdminLogout: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { useState } from "react";
import { StationFrame } from "./station-frame";

function StatefulWorkspace() {
  const [page, setPage] = useState(1);
  return <button onClick={() => setPage(page + 1)}>第 {page} 页</button>;
}
describe("StationFrame navigation", () => {
  beforeEach(() => {
    mocks.role = "SUPER_ADMIN";
    mocks.id = "admin-1";
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("默认展开所有功能分组", async () => {
    const user = userEvent.setup();
    render(<StationFrame title="分类与标签"><div>内容</div></StationFrame>);

    expect(screen.getByRole("button", { name: "运营管理" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "分类与标签" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "举报处理" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "举报与申诉" }));
    await user.click(screen.getByRole("button", { name: "举报与申诉" }));
    expect(screen.getByRole("link", { name: "举报处理" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "内容管理" })).toHaveAttribute("href", "/station/content");
  });

  it("普通管理员看不到超级管理员专属的账号入口", () => {
    mocks.role = "ADMIN";
    render(<StationFrame title="分类与标签"><div>内容</div></StationFrame>);

    expect(screen.queryByRole("link", { name: "管理员账号" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "操作日志" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "移动端版本" })).toHaveAttribute("href", "/station/mobile-releases");
  });

  it("已挂载工作区在管理员身份变化后重建，清空页面内部状态", async () => {
    const user = userEvent.setup();
    const view = render(<StationFrame title="用户管理"><StatefulWorkspace /></StationFrame>);
    await user.click(screen.getByRole("button", { name: "第 1 页" }));
    expect(screen.getByRole("button", { name: "第 2 页" })).toBeInTheDocument();
    mocks.id = "admin-2";
    view.rerender(<StationFrame title="用户管理"><StatefulWorkspace /></StationFrame>);
    expect(screen.getByRole("button", { name: "第 1 页" })).toBeInTheDocument();
  });

  it("固定全局导航并让右侧工作区适配剩余视口", () => {
    const { container } = render(
      <StationFrame title="分类与标签"><div>内容</div></StationFrame>,
    );

    expect(container.querySelector('[data-slot="station-shell"]'))
      .toHaveClass("w-full", "min-w-0", "overflow-x-hidden");
    expect(container.querySelector('[data-slot="station-shell"]'))
      .not.toHaveClass("min-w-[1600px]");
    expect(container.querySelector('[data-slot="station-content"]'))
      .toHaveClass("min-w-0", "pl-52");
    expect(container.querySelector('[data-slot="station-workspace"]'))
      .toHaveClass("min-w-0", "max-w-full", "p-4");
  });
});
