"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { WalletHistory } from "@/components/economy/wallet-history";
import { PageShell } from "@/components/layout/page-shell";

export default function WalletPage() {
  return (
    <RequireAuth>
      <PageShell width="md">
        <h1 className="mb-5 text-xl font-bold text-foreground">我的温油</h1>
        <WalletHistory />
      </PageShell>
    </RequireAuth>
  );
}
