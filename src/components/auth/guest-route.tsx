import { Suspense, type ReactNode } from "react";
import { GuestOnly } from "@/components/auth/guest-only";
import { LoadingState } from "@/components/shared/loading-state";

/** 可被多个访客路由 layout 复用的会话边界。 */
export function GuestRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingState variant="page" label="" />}>
      <GuestOnly>{children}</GuestOnly>
    </Suspense>
  );
}
