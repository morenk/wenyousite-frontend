import { METADATA_ELEMENT_STYLES } from "@wenyousite/foundation/elements";
import { cn } from "@/lib/utils";

const LEVEL_PREFIX = METADATA_ELEMENT_STYLES.level.format.replace(".N", "");

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
      data-slot="level-badge"
      className={cn(
        "inline-flex h-[var(--element-level-height)] items-center rounded-md bg-accent px-1.5 font-utility text-[length:var(--element-level-font-size)] font-bold leading-none tabular-nums text-accent-foreground",
        className,
      )}
      title={`用户等级 ${LEVEL_PREFIX}.${level}`}
    >
      {LEVEL_PREFIX}.{level}
    </span>
  );
}
