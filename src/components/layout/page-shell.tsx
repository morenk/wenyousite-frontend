import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const widthClasses = {
  sm: "max-w-sm",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  wide: "max-w-6xl",
} as const;

interface PageShellProps extends ComponentProps<"div"> {
  width?: keyof typeof widthClasses;
}

/** 桌面页面统一内容容器；只约束宽度与纵向留白，不承担业务布局。 */
export function PageShell({
  width = "lg",
  className,
  ...props
}: PageShellProps) {
  return (
    <div
      className={cn("mx-auto w-full px-4 py-6", widthClasses[width], className)}
      {...props}
    />
  );
}
