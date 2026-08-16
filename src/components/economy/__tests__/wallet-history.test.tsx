import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockUseWallet, mockUseWalletTransactions, mockWalletRefetch, mockTransactionsRefetch } = vi.hoisted(() => ({
  mockUseWallet: vi.fn(),
  mockUseWalletTransactions: vi.fn(),
  mockWalletRefetch: vi.fn(),
  mockTransactionsRefetch: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/api/hooks/use-economy", () => ({
  useWallet: () => mockUseWallet(),
  useWalletTransactions: (userId: string | undefined, cursor?: string) =>
    mockUseWalletTransactions(userId, cursor),
}));

import { WalletHistory } from "@/components/economy/wallet-history";

const dailyCheckIn = {
  id: "transaction-daily",
  type: "DAILY_CHECK_IN",
  direction: "INCOME",
  amount: "3",
  grossAmount: "3",
  recipientAmount: "3",
  platformAmount: "0",
  balanceAfter: "13",
  counterparty: null,
  target: { type: "NONE", id: null, title: null },
  createdAt: "2026-08-08T01:02:00Z",
};

const tipExpense = {
  id: "transaction-expense",
  type: "TIP",
  direction: "EXPENSE",
  amount: "10",
  grossAmount: "10",
  recipientAmount: "8",
  platformAmount: "2",
  balanceAfter: "3",
  counterparty: { id: "author-1", username: "作者", avatar: null, level: 2 },
  target: { type: "THREAD", id: "thread-1", title: "测试主题帖" },
  createdAt: "2026-08-08T02:03:00Z",
};

const tipIncome = {
  id: "transaction-income",
  type: "TIP",
  direction: "INCOME",
  amount: "8",
  grossAmount: "10",
  recipientAmount: "8",
  platformAmount: "2",
  balanceAfter: "21",
  counterparty: { id: "sender-1", username: "投入者", avatar: null, level: 1 },
  target: { type: "USER", id: "user-1", title: null },
  createdAt: "2026-08-08T03:04:00Z",
};

function walletResult(overrides: Record<string, unknown> = {}) {
  return {
    data: { balance: "9007199254740993", receivedTipTotal: "10", receivedTipCount: 1 },
    isLoading: false,
    isError: false,
    refetch: mockWalletRefetch,
    ...overrides,
  };
}

function transactionsResult(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      code: 0,
      message: "ok",
      data: [dailyCheckIn, tipExpense, tipIncome],
      meta: { cursor: null, hasMore: false },
    },
    isLoading: false,
    isError: false,
    refetch: mockTransactionsRefetch,
    ...overrides,
  };
}

describe("WalletHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue(walletResult());
    mockUseWalletTransactions.mockReturnValue(transactionsResult());
  });
  afterEach(cleanup);

  test("展示精确余额以及签到、支出和收入流水的业务含义", () => {
    render(<WalletHistory />);

    expect(screen.getByText("9,007,199,254,740,993")).toBeInTheDocument();
    expect(screen.getByText("每日在线签到")).toBeInTheDocument();
    expect(screen.getByText("投入给「测试主题帖」")).toBeInTheDocument();
    expect(screen.getByText("投入者 的投入")).toBeInTheDocument();
    expect(screen.getByText(/对方投入 10 升，实际到账 8 升/)).toBeInTheDocument();
    expect(screen.getByText("−10 升")).toBeInTheDocument();
    expect(screen.getByText("+8 升")).toBeInTheDocument();
    expect(screen.getByText("余额 3 升")).toBeInTheDocument();
  });

  test("余额失败时提供独立重试，不影响已加载流水", async () => {
    mockUseWallet.mockReturnValue(walletResult({ data: undefined, isError: true }));
    render(<WalletHistory />);

    expect(screen.getByText("余额加载失败")).toBeInTheDocument();
    expect(screen.getByText("每日在线签到")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "重试余额" }));
    expect(mockWalletRefetch).toHaveBeenCalledTimes(1);
  });

  test("区分流水加载、失败和空记录状态", async () => {
    mockUseWalletTransactions.mockReturnValue(transactionsResult({
      data: undefined,
      isLoading: true,
    }));
    const view = render(<WalletHistory />);
    expect(screen.getByRole("status", { name: "流水加载中" })).toBeInTheDocument();

    mockUseWalletTransactions.mockReturnValue(transactionsResult({
      data: undefined,
      isError: true,
    }));
    view.rerender(<WalletHistory />);
    expect(screen.getByText("流水加载失败")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(mockTransactionsRefetch).toHaveBeenCalledTimes(1);

    mockUseWalletTransactions.mockReturnValue(transactionsResult({
      data: {
        code: 0,
        message: "ok",
        data: [],
        meta: { cursor: null, hasMore: false },
      },
    }));
    view.rerender(<WalletHistory />);
    expect(screen.getByText("暂无收支记录")).toBeInTheDocument();
  });

  test("使用游标前后翻页且只渲染当前页流水", async () => {
    const secondPageExpense = {
      ...tipExpense,
      id: "transaction-page-2",
      target: { ...tipExpense.target, title: "第二页主题帖" },
    };
    mockUseWalletTransactions.mockImplementation((_userId, cursor) =>
      cursor === "cursor-2"
        ? transactionsResult({
            data: {
              code: 0,
              message: "ok",
              data: [secondPageExpense],
              meta: { cursor: null, hasMore: false },
            },
          })
        : transactionsResult({
            data: {
              code: 0,
              message: "ok",
              data: [dailyCheckIn],
              meta: { cursor: "cursor-2", hasMore: true },
            },
          }),
    );

    render(<WalletHistory />);
    expect(screen.getByText("第 1 页")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(await screen.findByText("投入给「第二页主题帖」")).toBeInTheDocument();
    expect(screen.queryByText("每日在线签到")).not.toBeInTheDocument();
    expect(screen.getByText("第 2 页")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
    expect(mockUseWalletTransactions).toHaveBeenLastCalledWith("user-1", "cursor-2");

    await userEvent.click(screen.getByRole("button", { name: "上一页" }));
    expect(await screen.findByText("每日在线签到")).toBeInTheDocument();
    expect(screen.queryByText("投入给「第二页主题帖」")).not.toBeInTheDocument();
    expect(screen.getByText("第 1 页")).toBeInTheDocument();
  });

  test("后续页失败时可重试或返回上一页", async () => {
    mockUseWalletTransactions.mockImplementation((_userId, cursor) =>
      cursor === "cursor-2"
        ? transactionsResult({ data: undefined, isError: true })
        : transactionsResult({
            data: {
              code: 0,
              message: "ok",
              data: [dailyCheckIn],
              meta: { cursor: "cursor-2", hasMore: true },
            },
          }),
    );

    render(<WalletHistory />);
    await userEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(await screen.findByText("流水加载失败")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(mockTransactionsRefetch).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "返回上一页" }));
    expect(await screen.findByText("每日在线签到")).toBeInTheDocument();
  });
});
