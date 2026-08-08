import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockUseAuth, mockUseDailyCheckIn, mockMutate, mockToastSuccess } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseDailyCheckIn: vi.fn(),
  mockMutate: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/api/hooks/use-economy", () => ({
  useDailyCheckIn: (userId: string | undefined) => {
    mockUseDailyCheckIn(userId);
    return { mutate: mockMutate };
  },
}));
vi.mock("sonner", () => ({ toast: { success: mockToastSuccess } }));

import { DailyCheckInBootstrap } from "@/components/economy/daily-check-in-bootstrap";

describe("DailyCheckInBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, isInitialized: true });
  });
  afterEach(cleanup);

  test("等待认证完成，登录用户出现后只发起一次自动签到", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: false });
    const view = render(<DailyCheckInBootstrap />);
    expect(mockMutate).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, isInitialized: true });
    view.rerender(<DailyCheckInBootstrap />);
    view.rerender(<DailyCheckInBootstrap />);
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  test("匿名会话不签到，账号切换后为新用户签到", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    const view = render(<DailyCheckInBootstrap />);
    expect(mockMutate).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, isInitialized: true });
    view.rerender(<DailyCheckInBootstrap />);
    mockUseAuth.mockReturnValue({ user: { id: "user-2" }, isInitialized: true });
    view.rerender(<DailyCheckInBootstrap />);
    expect(mockMutate).toHaveBeenCalledTimes(2);
    expect(mockUseDailyCheckIn).toHaveBeenLastCalledWith("user-2");
  });

  test("仅本次实际领取时显示轻提示", () => {
    render(<DailyCheckInBootstrap />);
    const options = mockMutate.mock.calls[0][1];
    options.onSuccess({ claimedNow: false, rewardAmount: "2" });
    expect(mockToastSuccess).not.toHaveBeenCalled();
    options.onSuccess({ claimedNow: true, rewardAmount: "3" });
    expect(mockToastSuccess).toHaveBeenCalledWith("今日签到获得 3 升温油");
  });
});
