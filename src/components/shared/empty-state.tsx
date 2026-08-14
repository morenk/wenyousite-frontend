/** 空状态提示组件 */

import type { FeedbackResourceState } from "@wenyousite/foundation/interaction";

import { WenyouIcon } from "@/components/ui/wenyou-icon";

const feedbackState = "empty" satisfies FeedbackResourceState;

interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div data-feedback-state={feedbackState} className="flex flex-col items-center justify-center gap-2 py-16">
      <WenyouIcon id="status.empty" className="h-12 w-12 text-muted-foreground/50" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
