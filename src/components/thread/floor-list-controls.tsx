"use client";

import type { FloorOrder } from "@/api/floor-query";
import {
  DiscussionListControls,
  type DiscussionAuthorOption,
} from "@/components/shared/discussion-list-controls";

interface FloorListControlsProps {
  order: FloorOrder;
  onOrderChange: (order: FloorOrder) => void;
  authorId?: string;
  onAuthorChange: (authorId?: string) => void;
  authors: DiscussionAuthorOption[];
  authorsLoading: boolean;
  authorsError: boolean;
  onRetryAuthors: () => void;
}

export function FloorListControls(props: FloorListControlsProps) {
  return (
    <DiscussionListControls
      {...props}
      subject="楼层"
      className="mb-3"
    />
  );
}
