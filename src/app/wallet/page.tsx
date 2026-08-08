"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { WalletHistory } from "@/components/economy/wallet-history";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";

export default function WalletPage() {
  return (
    <RequireAuth>
      <PageShell width="feed">
        <PageHeader title="我的温油" description="查看余额，以及最近的获得和投入记录。" />
        <WalletHistory />
      </PageShell>
    </RequireAuth>
  );
}
