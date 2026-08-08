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
        "inline-flex h-5 items-center rounded-md border border-primary/20 bg-primary/8 px-1.5 text-[10px] font-semibold tabular-nums text-primary",
        className,
      )}
      title={`用户等级 Lv.${level}`}
    >
      Lv.{level}
    </span>
  );
}
