import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  hide: vi.fn(),
}));
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock("@/api/hooks/use-admin", () => ({
  useAdminBearerContentActions: () => ({
    hide: { mutateAsync: hooks.hide, isPending: false },
  }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AdminContentModerationDialog } from "@/components/admin/admin-content-moderation-dialog";

describe("AdminContentModerationDialog", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "admin-1", role: "ADMIN" } });
    hooks.hide.mockResolvedValue({ hidden: true });
  });

  it("无需站务会话，填写理由后通过普通管理员登录态隐藏内容", async () => {
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

  it("普通用户不渲染管理员隐藏面板", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1", role: "USER" } });

    render(
      <AdminContentModerationDialog
        target={{ type: "post", id: "post-1", label: "楼层 #1" }}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("处置理由")).not.toBeInTheDocument();
  });
});
