import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
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
      user: { id: "admin-1", username: "站务员", role: mocks.role },
      session: {},
      csrfToken: "test",
    },
    isError: false,
  }),
  useAdminLogout: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { StationFrame } from "./station-frame";

describe("StationFrame navigation", () => {
  beforeEach(() => {
    mocks.role = "SUPER_ADMIN";
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("按功能域折叠一级导航并自动展开当前页面所在分组", async () => {
    const user = userEvent.setup();
    render(<StationFrame title="分类与标签" eyebrow="Taxonomy"><div>内容</div></StationFrame>);

    expect(screen.getByRole("button", { name: "运营配置" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "分类与标签" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "案件队列" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "内容治理" }));
    expect(screen.getByRole("link", { name: "案件队列" })).toBeInTheDocument();
  });

  it("普通管理员看不到超级管理员专属的账号入口", async () => {
    const user = userEvent.setup();
    mocks.role = "ADMIN";
    render(<StationFrame title="分类与标签" eyebrow="Taxonomy"><div>内容</div></StationFrame>);
    await user.click(screen.getByRole("button", { name: "安全与权限" }));
    expect(screen.queryByRole("link", { name: "站务账号" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "决定轨迹" })).toBeInTheDocument();
  });
});
