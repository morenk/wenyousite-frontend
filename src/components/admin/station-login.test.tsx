import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    mockSession.mockReturnValue({ data: null, sessionStatus: "unauthenticated" });
    mockChallenge.mockResolvedValue({ challengeId: "challenge-1" });
    mockVerify.mockResolvedValue({});
  });

  afterEach(cleanup);

  test.each([["a1" + "😀".repeat(3), false], ["a1" + "😀".repeat(98), true], ["a".repeat(101), false]])("登录密码边界在发出挑战前验证", async (password, allowed) => {
    render(<StationLogin />);
    fireEvent.change(screen.getByLabelText("账号"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: password } });
    await userEvent.click(screen.getByRole("button", { name: "继续" }));
    if (allowed) expect(mockChallenge).toHaveBeenCalledWith({ account: "admin@example.com", password });
    else {
      expect(mockChallenge).not.toHaveBeenCalled();
      expect(screen.getByLabelText("密码")).toHaveAttribute("aria-invalid", "true");
    }
  });

  test("完成密码与邮箱验证码两阶段登录", async () => {
    const user = userEvent.setup();
    render(<StationLogin />);

    await user.type(screen.getByLabelText("账号"), "admin@example.com");
    await user.type(screen.getByLabelText("密码"), "password123");
    await user.click(screen.getByRole("button", { name: "继续" }));

    await waitFor(() => expect(mockChallenge).toHaveBeenCalledWith({
      account: "admin@example.com",
      password: "password123",
    }));
    expect(screen.getByRole("heading", { name: "查收邮箱验证码" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("6 位验证码"), "123456");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith({
      challengeId: "challenge-1",
      code: "123456",
      rememberDevice: false,
    }));
  });

  test("返回修改账号不会再次提交登录挑战，且保留已填账号", async () => {
    const user = userEvent.setup();
    render(<StationLogin />);
    await user.type(screen.getByLabelText("账号"), "admin@example.com");
    await user.type(screen.getByLabelText("密码"), "password123");
    await user.click(screen.getByRole("button", { name: "继续" }));
    await screen.findByLabelText("6 位验证码");
    await user.click(screen.getByRole("button", { name: "返回修改账号" }));
    expect(await screen.findByLabelText("账号")).toHaveValue("admin@example.com");
    expect(mockChallenge).toHaveBeenCalledTimes(1);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  test("记住设备默认关闭，选择跨验证码和返回阶段保留，密码不保留", async () => {
    const user = userEvent.setup(); render(<StationLogin />);
    const option = screen.getByRole("checkbox", { name: "记住此设备（7天）" });
    expect(option).not.toBeChecked(); await user.click(option);
    await user.type(screen.getByLabelText("账号"), "admin@example.com");
    await user.type(screen.getByLabelText("密码"), "password123");
    await user.click(screen.getByRole("button", { name: "继续" }));
    await screen.findByLabelText("6 位验证码");
    await user.click(screen.getByRole("button", { name: "返回修改账号" }));
    expect(screen.getByRole("checkbox")).toBeChecked(); expect(screen.getByLabelText("密码")).toHaveValue("");
    await user.type(screen.getByLabelText("密码"), "password123");
    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.type(await screen.findByLabelText("6 位验证码"), "123456");
    await user.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith({ challengeId: "challenge-1", code: "123456", rememberDevice: true }));
  });

  test("字段错误通过共享 FormField 关联到对应控件", async () => {
    const user = userEvent.setup();
    render(<StationLogin />);

    await user.click(screen.getByRole("button", { name: "继续" }));

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
    mockSession.mockReturnValue({ sessionStatus: "authenticated", data: { id: "admin-session" } });

    const { container } = render(<StationLogin />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/station/dashboard"));
    expect(container).toBeEmptyDOMElement();
  });
});
