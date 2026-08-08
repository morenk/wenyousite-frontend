import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const widthClasses = {
  narrow: "max-w-narrow",
  feed: "max-w-feed",
  content: "max-w-content",
  workspace: "max-w-workspace",
  wide: "max-w-[80rem]",
} as const;

export type PageWidth = keyof typeof widthClasses;

interface PageShellProps extends ComponentProps<"div"> {
  width?: PageWidth;
}

/** 桌面页面统一内容容器；只约束宽度与纵向留白，不承担业务布局。 */
export function PageShell({
  width = "feed",
  className,
  ...props
}: PageShellProps) {
  return (
    <div
      data-slot="page-shell"
      className={cn("mx-auto w-full px-2 py-5 sm:px-3", widthClasses[width], className)}
      {...props}
    />
  );
}
