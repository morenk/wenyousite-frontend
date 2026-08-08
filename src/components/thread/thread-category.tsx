"use client";

import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { useThreadCategoriesContext } from "@/components/thread/thread-categories-provider";
import { getThreadCategoryPresentation } from "@/lib/thread-presentation";
import { cn } from "@/lib/utils";

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
      className={className}
      style={presentation.badgeStyle}
      {...props}
    >
      {presentation.label}
    </Badge>
  );
}

export function ThreadCategoryMarker({
  category,
  className,
  ...props
}: ComponentProps<"span"> & { category: string | null | undefined }) {
  const presentation = useThreadCategoryPresentation(category);
  return (
    <span
      className={cn(presentation.markerClassName, className)}
      style={presentation.markerStyle}
      aria-hidden="true"
      {...props}
    />
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
