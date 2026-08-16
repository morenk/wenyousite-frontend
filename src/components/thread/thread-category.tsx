"use client";

import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { useThreadCategoriesContext } from "@/components/thread/thread-categories-provider";
import { getThreadCategoryPresentation } from "@/lib/thread-presentation";

export function useThreadCategoryPresentation(category: string | null | undefined) {
  const { categories } = useThreadCategoriesContext();
  return getThreadCategoryPresentation(category, categories);
}

export function ThreadCategoryBadge({
  category,
  className,
  ...props
}: Omit<ComponentProps<typeof Badge>, "tone"> & {
  category: string | null | undefined;
}) {
  const presentation = useThreadCategoryPresentation(category);
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
}: {
  category: string | null | undefined;
}) {
  const presentation = useThreadCategoryPresentation(category);
  return <>{presentation.label}</>;
}
