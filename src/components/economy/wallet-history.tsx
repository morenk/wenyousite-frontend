"use client";

import { ChevronLeft, ChevronRight, Loader2, WalletCards } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatWenyou } from "@/lib/wenyou";
import { useWallet, useWalletTransactions, type WalletTransaction } from "@/api/hooks/use-economy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";

function transactionTitle(transaction: WalletTransaction): string {
  if (transaction.type === "DAILY_CHECK_IN") return "每日在线签到";
  const target = transaction.target.title
    ? `「${transaction.target.title}」`
    : transaction.counterparty?.username ?? "用户";
  return transaction.direction === "EXPENSE"
    ? `投入给${target}`
    : `${transaction.counterparty?.username ?? "用户"} 的投入`;
}

export function WalletHistory() {
  const { user } = useAuth();
  const wallet = useWallet(user?.id);
  const pagination = useCursorPagination(user?.id ?? "wallet-anonymous");
  const transactions = useWalletTransactions(user?.id, pagination.cursor);
  const items = transactions.data?.data ?? [];
  const nextCursor = transactions.data?.meta.hasMore
    ? transactions.data.meta.cursor
    : null;

  return (
    <div className="w-full space-y-5">
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-6">
          <div>
            <p className="text-sm text-muted-foreground">温油余额</p>
            {wallet.isLoading ? (
              <p className="mt-2 text-sm text-muted-foreground" role="status">
                余额加载中…
              </p>
            ) : wallet.isError ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-destructive">余额加载失败</span>
                <Button variant="outline" size="sm" onClick={() => wallet.refetch()}>
                  重试余额
                </Button>
              </div>
            ) : (
              <p className="mt-1 font-utility text-3xl font-bold tabular-nums text-foreground">
                {wallet.data ? formatWenyou(wallet.data.balance) : "—"}
                <span className="ml-1 text-sm font-medium text-muted-foreground">升</span>
              </p>
            )}
          </div>
          <WalletCards className="h-10 w-10 text-brand-strong/70" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">收支记录</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.isLoading ? (
            <div className="flex justify-center py-12" role="status" aria-label="流水加载中">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.isError ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <EmptyState title="流水加载失败" />
              <div className="flex items-center gap-2">
                {pagination.hasPrevious && (
                  <Button variant="ghost" size="sm" onClick={pagination.previous}>
                    <ChevronLeft className="h-4 w-4" />
                    返回上一页
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => transactions.refetch()}>
                  重试
                </Button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <EmptyState title="暂无收支记录" />
          ) : (
            <div className="divide-y divide-border">
              {items.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {transactionTitle(transaction)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <WenyouTime value={transaction.createdAt} />
                      {transaction.type === "TIP" && transaction.direction === "INCOME" && (
                        <> · 对方投入 {formatWenyou(transaction.grossAmount)} 升，实际到账 {formatWenyou(transaction.recipientAmount)} 升</>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={transaction.direction === "INCOME"
                      ? "font-utility font-bold tabular-nums text-success"
                      : "font-utility font-bold tabular-nums text-foreground"
                    }>
                      {transaction.direction === "INCOME" ? "+" : "−"}
                      {formatWenyou(transaction.amount)} 升
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      余额 {formatWenyou(transaction.balanceAfter)} 升
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!transactions.isLoading
            && !transactions.isError
            && (items.length > 0 || pagination.hasPrevious) && (
            <nav
              className="mt-4 flex items-center justify-center gap-2 border-t border-border pt-4"
              aria-label="收支记录分页"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={pagination.previous}
                disabled={!pagination.hasPrevious}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <span className="min-w-16 text-center text-sm tabular-nums text-muted-foreground">
                第 {pagination.page} 页
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (nextCursor) pagination.next(nextCursor);
                }}
                disabled={!nextCursor}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
