import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoadErrorProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/** 查询失败的统一展示；业务模块只提供面向用户的文案和可选重试动作。 */
export function LoadError({ title, description, onRetry, className }: LoadErrorProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-12 text-center", className)}>
      <AlertCircle className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      )}
    </div>
  );
}
