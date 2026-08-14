import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useAdminSession: vi.fn(),
  hide: vi.fn(),
  restore: vi.fn(),
}));
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock("@/api/hooks/use-admin", () => ({
  useAdminSession: (...args: unknown[]) => hooks.useAdminSession(...args),
  useAdminContentActions: () => ({
    hide: { mutateAsync: hooks.hide, isPending: false },
    restore: { mutateAsync: hooks.restore, isPending: false },
  }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AdminContentModerationDialog } from "@/components/admin/admin-content-moderation-dialog";

describe("AdminContentModerationDialog", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "admin-1", role: "ADMIN" } });
    hooks.useAdminSession.mockReturnValue({
      data: { user: { id: "admin-1", role: "ADMIN" } },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
    hooks.hide.mockResolvedValue({ hidden: true });
  });

  it("要求填写理由后通过站务隐藏接口处置内容", async () => {
    const onOpenChange = vi.fn();
    const onHidden = vi.fn();
    render(
      <AdminContentModerationDialog
        target={{ type: "moment", id: "moment-1", label: "动态" }}
        open
        onOpenChange={onOpenChange}
        onHidden={onHidden}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "确认隐藏" }));
    expect(await screen.findByText("请填写处置理由")).toBeInTheDocument();
    expect(hooks.hide).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("处置理由"), {
      target: { value: "违反动态区规则" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认隐藏" }));

    await waitFor(() => {
      expect(hooks.hide).toHaveBeenCalledWith({
        type: "moment",
        id: "moment-1",
        reason: "违反动态区规则",
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onHidden).toHaveBeenCalledOnce();
  });

  it("站务会话失效时只提供登录与重新核验，不显示处置表单", () => {
    const refetch = vi.fn();
    hooks.useAdminSession.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      refetch,
    });

    render(
      <AdminContentModerationDialog
        target={{ type: "post", id: "post-1", label: "楼层 #1" }}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("需要独立站务会话")).toBeInTheDocument();
    expect(screen.queryByLabelText("处置理由")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /打开站务登录/ })).toHaveAttribute("href", "/station");
    fireEvent.click(screen.getByRole("button", { name: "重新核验" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
