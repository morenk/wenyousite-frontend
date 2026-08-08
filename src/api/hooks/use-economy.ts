/** 温油钱包、签到、流水与打赏 API hooks。 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components, operations } from "@/api/types";

export type Wallet = components["schemas"]["WalletResponseDto"];
export type WalletTransaction = components["schemas"]["WalletTransactionResponseDto"];
export type TipResponse = components["schemas"]["TipResponseDto"];
export type WalletTransactionsResponse =
  operations["economyTransactions"]["responses"][200]["content"]["application/json"];

export function useWallet(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.wallet.detail(userId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/wallet");
      if (error) throw error;
      if (!data) throw new Error("获取温油钱包失败");
      return data.data;
    },
    enabled: !!userId,
    staleTime: 10 * 1000,
  });
}

export function useDailyCheckIn(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.POST("/api/v1/wallet/check-in");
      if (error) throw error;
      if (!data) throw new Error("签到响应为空");
      return data.data;
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Wallet>(queryKeys.wallet.detail(userId), (wallet) =>
        wallet ? { ...wallet, balance: result.balance } : wallet,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet.transactions(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
      }
    },
  });
}

export function useWalletTransactions(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.wallet.transactions(userId),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const { data, error } = await apiClient.GET("/api/v1/wallet/transactions", {
        params: {
          query: {
            limit: 20,
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        },
      });
      if (error) throw error;
      if (!data) {
        return {
          code: 0,
          message: "ok",
          data: [],
          meta: { cursor: null, hasMore: false },
        } satisfies WalletTransactionsResponse;
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.meta.hasMore ? page.meta.cursor ?? undefined : undefined,
    enabled: !!userId,
    staleTime: 10 * 1000,
  });
}

export type TipTarget =
  | { type: "THREAD"; id: string; recipientUserId: string }
  | { type: "USER"; id: string };

export function useTipWenyou(target: TipTarget, userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      amount,
      clientRequestId,
    }: {
      amount: string;
      clientRequestId: string;
    }) => {
      const body = { amount, clientRequestId };
      const response = target.type === "THREAD"
        ? await apiClient.POST("/api/v1/threads/{id}/tips", {
            params: { path: { id: target.id } },
            body,
          })
        : await apiClient.POST("/api/v1/users/{id}/tips", {
            params: { path: { id: target.id } },
            body,
          });
      if (response.error) throw response.error;
      if (!response.data) throw new Error("打赏响应为空");
      return response.data.data;
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Wallet>(queryKeys.wallet.detail(userId), (wallet) =>
        wallet ? { ...wallet, balance: result.balance } : wallet,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet.transactions(userId) });
      if (target.type === "THREAD") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(target.id) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.users.detail(target.recipientUserId),
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(target.id) });
      }
    },
  });
}
