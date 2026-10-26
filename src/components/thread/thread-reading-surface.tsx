import type { ComponentProps } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { cn } from "@/lib/utils";

/** 主楼层与完整回复共用动态详情式阅读底色，内嵌回复保持下一层浅灰。 */
export function ThreadReadingSurface({ className, ...props }: ComponentProps<typeof PageShell>) {
  return <PageShell {...props} className={cn("bg-background", className)} />;
}
