import { RequireAuth } from "@/components/auth/require-auth";
import { PageShell } from "@/components/layout/page-shell";
import { ModerationDecisionsPanel } from "@/components/user/moderation-decisions-panel";

export default function MyModerationPage() {
  return (
    <RequireAuth requireVerifiedEmail>
      <PageShell width="feed" className="py-8">
        <p className="font-utility text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">Moderation</p>
        <h1 className="mt-1 font-display text-3xl font-bold">治理决定与申诉</h1>
        <p className="mt-3 text-sm text-muted-foreground">你可以在决定作出后的 30 天内提交一次申诉。</p>
        <ModerationDecisionsPanel />
      </PageShell>
    </RequireAuth>
  );
}
