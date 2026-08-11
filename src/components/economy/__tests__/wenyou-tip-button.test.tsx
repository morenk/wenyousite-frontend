import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockMutateAsync, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "sender-1" } }) }));
vi.mock("@/api/hooks/use-economy", () => ({
  useTipWenyou: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

import { WenyouTipButton } from "@/components/economy/wenyou-tip-button";

describe("WenyouTipButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({
      grossAmount: "10",
      recipientAmount: "8",
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function mockRequestIds(...ids: string[]) {
    return vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => {
      const next = ids.shift();
      if (!next) throw new Error("测试未提供足够的 UUID");
      return next as `${string}-${string}-${string}-${string}-${string}`;
    });
  }

  test("提交整数升数后只确认本次加油金额", async () => {
    const user = userEvent.setup();
    render(
      <WenyouTipButton
        target={{ type: "USER", id: "recipient-1" }}
        recipientName="作者"
      />,
    );
    const trigger = screen.getByRole("button", { name: "加油" });
    expect(trigger).not.toHaveClass("bg-primary");
    expect(trigger).not.toHaveClass("border-border");
    await user.click(trigger);
    expect(screen.getByRole("heading", { name: "为作者加油" })).toBeInTheDocument();
    expect(screen.queryByText(/到账|平台保留|85%/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).not.toHaveClass("border-border");
    const input = screen.getByLabelText("投入升数");
    await user.clear(input);
    await user.type(input, "10");
    await user.click(screen.getByRole("button", { name: "确认加油" }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      amount: "10",
      clientRequestId: expect.any(String),
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("已加油 10 升");
  });

  test("拒绝低于 2 升的投入", async () => {
    const user = userEvent.setup();
    render(
      <WenyouTipButton
        target={{ type: "USER", id: "recipient-1" }}
        recipientName="作者"
      />,
    );
    await user.click(screen.getByRole("button", { name: "加油" }));
    const input = screen.getByLabelText("投入升数");
    await user.clear(input);
    await user.type(input, "1");
    await user.click(screen.getByRole("button", { name: "确认加油" }));
    expect(await screen.findByText("最低投入 2 升，且只能填写整数")).toBeInTheDocument();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  test("失败后以相同金额重试时复用同一个客户端请求 ID", async () => {
    const user = userEvent.setup();
    mockRequestIds("11111111-1111-4111-8111-111111111111");
    mockMutateAsync
      .mockRejectedValueOnce({ message: "网络暂时不可用" })
      .mockResolvedValueOnce({ grossAmount: "10", recipientAmount: "8" });
    render(
      <WenyouTipButton
        target={{ type: "USER", id: "recipient-1" }}
        recipientName="作者"
      />,
    );

    await user.click(screen.getByRole("button", { name: "加油" }));
    const input = screen.getByLabelText("投入升数");
    await user.clear(input);
    await user.type(input, "10");
    await user.click(screen.getByRole("button", { name: "确认加油" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("网络暂时不可用");
    });

    await user.click(screen.getByRole("button", { name: "确认加油" }));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
    expect(mockMutateAsync.mock.calls[0][0].clientRequestId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mockMutateAsync.mock.calls[1][0].clientRequestId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  test("失败后改变金额会生成新的客户端请求 ID", async () => {
    const user = userEvent.setup();
    mockRequestIds(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );
    mockMutateAsync
      .mockRejectedValueOnce({ message: "网络暂时不可用" })
      .mockResolvedValueOnce({ grossAmount: "11", recipientAmount: "9" });
    render(
      <WenyouTipButton
        target={{ type: "USER", id: "recipient-1" }}
        recipientName="作者"
      />,
    );

    await user.click(screen.getByRole("button", { name: "加油" }));
    const input = screen.getByLabelText("投入升数");
    await user.clear(input);
    await user.type(input, "10");
    await user.click(screen.getByRole("button", { name: "确认加油" }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    await user.clear(input);
    await user.type(input, "11");
    await user.click(screen.getByRole("button", { name: "确认加油" }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
    expect(mockMutateAsync.mock.calls.map(([request]) => request.clientRequestId)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  test("成功后的下一次投入会生成新的客户端请求 ID", async () => {
    const user = userEvent.setup();
    mockRequestIds(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );
    render(
      <WenyouTipButton
        target={{ type: "USER", id: "recipient-1" }}
        recipientName="作者"
      />,
    );

    await user.click(screen.getByRole("button", { name: "加油" }));
    await user.click(screen.getByRole("button", { name: "确认加油" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "确认加油" })).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "加油" }));
    await user.click(screen.getByRole("button", { name: "确认加油" }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
    expect(mockMutateAsync.mock.calls.map(([request]) => request.clientRequestId)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  test("请求尚未完成时忽略快速重复提交", async () => {
    const user = userEvent.setup();
    mockRequestIds("11111111-1111-4111-8111-111111111111");
    let resolveRequest!: (value: { grossAmount: string; recipientAmount: string }) => void;
    mockMutateAsync.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(
      <WenyouTipButton
        target={{ type: "USER", id: "recipient-1" }}
        recipientName="作者"
      />,
    );

    await user.click(screen.getByRole("button", { name: "加油" }));
    await user.dblClick(screen.getByRole("button", { name: "确认加油" }));
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest({ grossAmount: "2", recipientAmount: "1" });
    });
  });
});
