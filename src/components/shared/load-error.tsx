import type { FeedbackResourceState } from "@wenyousite/foundation/interaction";
import { LANGUAGE_ACTIONS } from "@wenyousite/foundation/language";

import { Button } from "@/components/ui/button";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";

const feedbackState = "error" satisfies FeedbackResourceState;

interface LoadErrorProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/** 查询失败的统一展示；业务模块只提供面向用户的文案和可选重试动作。 */
export function LoadError({ title, description, onRetry, className }: LoadErrorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-feedback-state={feedbackState}
      className={cn("flex flex-col items-center gap-3 py-12 text-center", className)}
    >
      <WenyouIcon id="status.error" className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {LANGUAGE_ACTIONS.retry}
        </Button>
      )}
    </div>
  );
}
