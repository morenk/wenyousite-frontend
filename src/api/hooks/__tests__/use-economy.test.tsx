import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { queryKeys } from "@/api/query-keys";

const { mockGET, mockPOST } = vi.hoisted(() => ({
  mockGET: vi.fn(),
  mockPOST: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET, POST: mockPOST },
}));

import {
  useDailyCheckIn,
  useTipWenyou,
  useWallet,
  useWalletTransactions,
} from "@/api/hooks/use-economy";

function createHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, wrapper: Wrapper };
}

const wallet = {
  balance: "9",
  receivedTipTotal: "20",
  receivedTipCount: 2,
};

const checkInResult = {
  claimedNow: true,
  date: "2026-08-07",
  rewardAmount: "3" as const,
  experienceAwarded: 2,
  balance: "12",
  progression: {
    level: 1,
    experience: 2,
    currentLevelExperience: 0,
    nextLevelExperience: 50,
  },
};

const tipResult = {
  transactionId: "transaction-1",
  grossAmount: "10",
  recipientAmount: "8",
  platformAmount: "2",
  balance: "2",
  threadTipTotal: "10",
  recipientTipTotal: "10",
  recipientTipCount: 1,
};

describe("economy hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  test("钱包查询读取完整钱包，并在没有登录用户时不请求私有接口", async () => {
    mockGET.mockResolvedValue({ data: { data: wallet } });
    const authenticated = createHarness();
    const { result } = renderHook(() => useWallet("user-1"), {
      wrapper: authenticated.wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual(wallet));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/wallet");

    mockGET.mockClear();
    const anonymous = createHarness();
    const guest = renderHook(() => useWallet(undefined), { wrapper: anonymous.wrapper });
    expect(guest.result.current.fetchStatus).toBe("idle");
    expect(mockGET).not.toHaveBeenCalled();
  });

  test("钱包流水按服务端 cursor 查询并分别缓存每一页", async () => {
    mockGET
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: [{ id: "transaction-1" }],
          meta: { cursor: "cursor-2", hasMore: true },
        },
      })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: [{ id: "transaction-2" }],
          meta: { cursor: null, hasMore: false },
        },
      });
    const { client, wrapper } = createHarness();
    const { result, rerender } = renderHook(
      ({ cursor }: { cursor?: string }) => useWalletTransactions("user-1", cursor),
      { wrapper, initialProps: { cursor: undefined as string | undefined } },
    );

    await waitFor(() => expect(result.current.data?.meta.hasMore).toBe(true));
    rerender({ cursor: "cursor-2" });
    await waitFor(() => expect(result.current.data?.data).toEqual([{ id: "transaction-2" }]));

    expect(mockGET).toHaveBeenNthCalledWith(1, "/api/v1/wallet/transactions", {
      params: { query: { limit: 20 } },
    });
    expect(mockGET).toHaveBeenNthCalledWith(2, "/api/v1/wallet/transactions", {
      params: { query: { limit: 20, cursor: "cursor-2" } },
    });
    expect(client.getQueryData(queryKeys.wallet.transactionPage("user-1")))
      .toMatchObject({ data: [{ id: "transaction-1" }] });
    expect(client.getQueryData(queryKeys.wallet.transactionPage("user-1", "cursor-2")))
      .toMatchObject({ data: [{ id: "transaction-2" }] });
  });

  test("签到返回服务端幂等结果并刷新余额、流水和等级相关缓存", async () => {
    mockPOST.mockResolvedValue({ data: { data: checkInResult } });
    const { client, wrapper } = createHarness();
    const firstTransactionsKey = queryKeys.wallet.transactionPage("user-1");
    const nextTransactionsKey = queryKeys.wallet.transactionPage("user-1", "cursor-2");
    const profileKey = queryKeys.users.detailForViewer("user-1", "viewer-user-1");
    client.setQueryData(queryKeys.wallet.detail("user-1"), wallet);
    client.setQueryData(firstTransactionsKey, { data: [] });
    client.setQueryData(nextTransactionsKey, { data: [] });
    client.setQueryData(queryKeys.me, { level: 1 });
    client.setQueryData(profileKey, { level: 1 });
    const { result } = renderHook(() => useDailyCheckIn("user-1"), { wrapper });

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync();
    });

    expect(response).toEqual(checkInResult);
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/wallet/check-in");
    expect(client.getQueryData(queryKeys.wallet.detail("user-1"))).toEqual({
      ...wallet,
      balance: "12",
    });
    expect(client.getQueryState(firstTransactionsKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(nextTransactionsKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.me)?.isInvalidated).toBe(true);
    expect(client.getQueryState(profileKey)?.isInvalidated).toBe(true);
  });

  test("缓存尚不存在时签到不会伪造累计收款统计", async () => {
    mockPOST.mockResolvedValue({ data: { data: checkInResult } });
    const { client, wrapper } = createHarness();
    const { result } = renderHook(() => useDailyCheckIn("user-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(client.getQueryData(queryKeys.wallet.detail("user-1"))).toBeUndefined();
  });

  test("主题帖投入刷新付款钱包、流水、主题帖和收款人资料", async () => {
    mockPOST.mockResolvedValue({ data: { data: tipResult } });
    const { client, wrapper } = createHarness();
    const walletKey = queryKeys.wallet.detail("user-1");
    const firstTransactionsKey = queryKeys.wallet.transactionPage("user-1");
    const nextTransactionsKey = queryKeys.wallet.transactionPage("user-1", "cursor-2");
    const threadKey = queryKeys.threads.detailForViewer("thread-1", "viewer-user-1");
    const listKey = queryKeys.threads.list({ sort: "active" });
    const recipientKey = queryKeys.users.detailForViewer("owner-1", "viewer-user-1");
    client.setQueryData(walletKey, wallet);
    client.setQueryData(firstTransactionsKey, { data: [] });
    client.setQueryData(nextTransactionsKey, { data: [] });
    client.setQueryData(threadKey, { tipTotal: "0" });
    client.setQueryData(listKey, { pages: [] });
    client.setQueryData(recipientKey, { receivedTipTotal: "0" });
    const { result } = renderHook(
      () => useTipWenyou({
        type: "THREAD",
        id: "thread-1",
        recipientUserId: "owner-1",
      }, "user-1"),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        amount: "10",
        clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
      });
    });

    expect(mockPOST).toHaveBeenCalledWith("/api/v1/threads/{id}/tips", {
      params: { path: { id: "thread-1" } },
      body: {
        amount: "10",
        clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
      },
    });
    expect(client.getQueryData(walletKey)).toEqual({ ...wallet, balance: "2" });
    expect(client.getQueryState(firstTransactionsKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(nextTransactionsKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(threadKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(recipientKey)?.isInvalidated).toBe(true);
  });

  test("直接向用户投入使用用户接口并刷新该用户资料", async () => {
    mockPOST.mockResolvedValue({ data: { data: tipResult } });
    const { client, wrapper } = createHarness();
    const recipientKey = queryKeys.users.detailForViewer("recipient-1", "viewer-user-1");
    client.setQueryData(recipientKey, { receivedTipTotal: "0" });
    const { result } = renderHook(
      () => useTipWenyou({ type: "USER", id: "recipient-1" }, "user-1"),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        amount: "10",
        clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
      });
    });

    expect(mockPOST).toHaveBeenCalledWith("/api/v1/users/{id}/tips", {
      params: { path: { id: "recipient-1" } },
      body: {
        amount: "10",
        clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
      },
    });
    expect(client.getQueryState(recipientKey)?.isInvalidated).toBe(true);
  });

  test("给动态加油原地更新累计值，不重新请求并重排瀑布流", async () => {
    mockPOST.mockResolvedValue({
      data: { data: { ...tipResult, threadTipTotal: undefined, momentTipTotal: "14" } },
    });
    const { client, wrapper } = createHarness();
    const momentKey = queryKeys.moments.list("DISCOVER", "user-1");
    const moment = {
      id: "moment-1",
      coverType: "TEXT",
      title: "动态",
      contentExcerpt: "正文",
      likeCount: 0,
      commentCount: 0,
      bookmarkCount: 0,
      tipTotal: "4",
      viewerLiked: false,
      viewerBookmarked: false,
    };
    client.setQueryData(momentKey, { pages: [{ data: [moment] }] });
    const { result } = renderHook(
      () => useTipWenyou({ type: "MOMENT", id: "moment-1", recipientUserId: "owner-1" }, "user-1"),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        amount: "10",
        clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
      });
    });

    expect(mockPOST).toHaveBeenCalledWith("/api/v1/moments/{id}/tips", {
      params: { path: { id: "moment-1" } },
      body: { amount: "10", clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be" },
    });
    const cached = client.getQueryData<{ pages: { data: { tipTotal: string }[] }[] }>(momentKey);
    expect(cached?.pages[0].data[0].tipTotal).toBe("14");
    expect(client.getQueryState(momentKey)?.isInvalidated).toBe(false);
  });
});
