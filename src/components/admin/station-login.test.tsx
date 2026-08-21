import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockChallenge,
  mockReplace,
  mockSession,
  mockToastError,
  mockVerify,
} = vi.hoisted(() => ({
  mockChallenge: vi.fn(),
  mockReplace: vi.fn(),
  mockSession: vi.fn(),
  mockToastError: vi.fn(),
  mockVerify: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/api/hooks/use-admin", () => ({
  useAdminSession: () => mockSession(),
  useAdminLogin: () => ({
    challenge: { mutateAsync: mockChallenge, isPending: false },
    verify: { mutateAsync: mockVerify, isPending: false },
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

import { StationLogin } from "@/components/admin/station-login";

describe("StationLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockReturnValue({ data: null });
    mockChallenge.mockResolvedValue({ challengeId: "challenge-1" });
    mockVerify.mockResolvedValue({});
  });

  afterEach(cleanup);

  test("完成密码与邮箱验证码两阶段登录", async () => {
    const user = userEvent.setup();
    render(<StationLogin />);

    await user.type(screen.getByLabelText("账号"), "admin@example.com");
    await user.type(screen.getByLabelText("密码"), "password123");
    await user.click(screen.getByRole("button", { name: "继续邮箱确认" }));

    await waitFor(() => expect(mockChallenge).toHaveBeenCalledWith({
      account: "admin@example.com",
      password: "password123",
    }));
    expect(screen.getByRole("heading", { name: "查收邮箱验证码" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("6 位验证码"), "123456");
    await user.click(screen.getByRole("button", { name: "进入站务台" }));

    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith({
      challengeId: "challenge-1",
      code: "123456",
    }));
    expect(mockReplace).toHaveBeenCalledWith("/station/dashboard");
  });

  test("字段错误通过共享 FormField 关联到对应控件", async () => {
    const user = userEvent.setup();
    render(<StationLogin />);

    await user.click(screen.getByRole("button", { name: "继续邮箱确认" }));

    expect(await screen.findByText("请输入管理员账号")).toHaveAttribute(
      "id",
      "station-account-error",
    );
    expect(screen.getByLabelText("账号")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("密码")).toHaveAttribute(
      "aria-describedby",
      "station-password-error",
    );
    expect(mockChallenge).not.toHaveBeenCalled();
  });

  test("已有站务会话时直接进入控制台", async () => {
    mockSession.mockReturnValue({ data: { id: "admin-session" } });

    const { container } = render(<StationLogin />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/station/dashboard"));
    expect(container).toBeEmptyDOMElement();
  });
});
