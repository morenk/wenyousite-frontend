import { cn } from "@/lib/utils";

export function LevelBadge({
  level,
  className,
}: {
  level: number | undefined;
  className?: string;
}) {
  if (!level) return null;
  return (
    <span
      className={cn(
        "inline-flex min-h-5 items-center rounded-md bg-accent px-1.5 font-utility text-[0.6875rem] leading-5 font-bold tabular-nums text-accent-foreground",
        className,
      )}
      title={`用户等级 Lv.${level}`}
    >
      Lv.{level}
    </span>
  );
}
