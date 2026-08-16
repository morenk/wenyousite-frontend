import { METADATA_ELEMENT_STYLES } from "@wenyousite/foundation/elements";

import { cn } from "@/lib/utils";

const MAXIMUM_DISPLAY = METADATA_ELEMENT_STYLES.unreadCount.maximumDisplay;

export function UnreadCountBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  const display = count > 99 ? MAXIMUM_DISPLAY : String(count);

  return (
    <span
      data-slot="unread-count"
      aria-label={`${display} 条未读`}
      className={cn(
        "inline-flex h-[var(--element-unread-count-height)] min-w-[var(--element-unread-count-height)] shrink-0 items-center justify-center rounded-full bg-destructive px-1 font-utility text-[length:var(--element-unread-count-font-size)] font-bold leading-none tabular-nums text-destructive-foreground",
        className,
      )}
    >
      {display}
    </span>
  );
}
