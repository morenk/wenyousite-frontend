import { levelTier, METADATA_ELEMENT_STYLES } from "@wenyousite/foundation/elements";
import type { CSSProperties } from "react";
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
  const tier = levelTier(level);
  if (!tier) return null;
  const tierStyle = {
    backgroundColor: `var(--element-level-${tier.id}-surface)`,
    borderColor: `var(--element-level-${tier.id}-border)`,
    color: `var(--element-level-${tier.id}-foreground)`,
  } satisfies CSSProperties;
  return (
    <span
      data-slot="level-badge"
      data-level-tier={tier.id}
      className={cn(
        "inline-flex h-[var(--element-level-height)] items-center rounded-md border px-1.5 font-utility text-[length:var(--element-level-font-size)] font-bold leading-none tabular-nums",
        className,
      )}
      style={tierStyle}
      title={`用户等级 ${LEVEL_PREFIX}.${level}`}
    >
      {LEVEL_PREFIX}.{level}
    </span>
  );
}
