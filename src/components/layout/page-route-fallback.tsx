import { NavigationProgress } from "@/components/layout/navigation-progress";
import { PageShell } from "@/components/layout/page-shell";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";

export type PageRouteFallbackVariant = "feed" | "detail" | "profile";

export function PageRouteFallback({
  variant = "feed",
}: {
  variant?: PageRouteFallbackVariant;
}) {
  return (
    <div role="status" aria-label="页面加载中" data-slot="page-route-fallback">
      <NavigationProgress />
      {variant === "detail" ? (
        <DetailFallback />
      ) : variant === "profile" ? (
        <ProfileFallback />
      ) : (
        <FeedFallback />
      )}
    </div>
  );
}

function FeedFallback() {
  return (
    <PageShell width="feed" className="py-5">
      <Panel padding="none" className="overflow-hidden px-5 pt-6 pb-5">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        <div className="mt-6 flex gap-3 border-t border-border pt-4">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
      </Panel>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex gap-3.5 border-b border-border px-5 py-[1.125rem] last:border-b-0"
          >
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function DetailFallback() {
  return (
    <PageShell width="feed" className="py-5">
      <Panel className="border-l-4 border-l-primary">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
        <Skeleton className="mt-5 h-8 w-4/5 rounded-lg" />
        <Skeleton className="mt-3 h-4 w-48" />
      </Panel>
      <Panel className="mt-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="mt-5 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-3/4" />
      </Panel>
      <div className="mt-4 space-y-4">
        {Array.from({ length: 2 }, (_, index) => (
          <Panel key={index}>
            <div className="flex gap-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-5 h-4 w-full" />
                <Skeleton className="mt-3 h-4 w-5/6" />
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}

function ProfileFallback() {
  return (
    <PageShell width="feed" className="py-5">
      <Panel padding="none" className="overflow-hidden pb-5">
        <Skeleton className="aspect-3/1 w-full rounded-none" />
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 px-5">
          <Skeleton className="-mt-12 size-24 shrink-0 rounded-full ring-4 ring-card" />
          <div className="min-w-0 pt-4">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-7 w-40 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <Skeleton className="mt-3 h-4 w-64 max-w-full" />
          </div>
        </div>
      </Panel>
      {Array.from({ length: 3 }, (_, index) => (
        <Panel key={index} className="mt-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-5 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-3/4" />
        </Panel>
      ))}
    </PageShell>
  );
}
