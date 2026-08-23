import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import {
  getThreadCategoryPresentation,
  type ThreadCategoryInfo,
} from "@/lib/thread-presentation";

export function ThreadCategoryBadge({
  category,
  categoryInfo,
  className,
  ...props
}: Omit<ComponentProps<typeof Badge>, "tone"> & {
  category: string | null | undefined;
  categoryInfo: ThreadCategoryInfo | null | undefined;
}) {
  const presentation = getThreadCategoryPresentation(categoryInfo, category);
  return (
    <Badge
      tone={presentation.badgeTone}
      data-slot="category-badge"
      className={className}
      {...props}
    >
      {presentation.label}
    </Badge>
  );
}

export function ThreadCategoryLabel({
  category,
  categoryInfo,
}: {
  category: string | null | undefined;
  categoryInfo: ThreadCategoryInfo | null | undefined;
}) {
  const presentation = getThreadCategoryPresentation(categoryInfo, category);
  return <>{presentation.label}</>;
}
