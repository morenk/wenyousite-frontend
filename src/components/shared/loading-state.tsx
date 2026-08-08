import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  label?: string;
  variant?: "page" | "section" | "inline";
  className?: string;
}

/** 可复用加载态；页面、区块和行内三种尺寸保持一致的无障碍语义。 */
export function LoadingState({
  label = "加载中…",
  variant = "section",
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center text-muted-foreground",
        variant === "page" && "min-h-screen",
        variant === "section" && "min-h-40 py-12",
        variant === "inline" && "gap-2",
        className,
      )}
    >
      <Loader2
        aria-hidden="true"
        className={cn(
          "animate-spin",
          variant === "page" ? "h-6 w-6" : "h-5 w-5",
          variant !== "inline" && label && "mr-2",
        )}
      />
      {label && <span className={cn(variant !== "inline" && "text-sm")}>{label}</span>}
    </div>
  );
}
