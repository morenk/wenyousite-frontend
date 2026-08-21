import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormFieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export interface FormFieldProps {
  id: string;
  label: ReactNode;
  labelAction?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (controlProps: FormFieldControlProps) => ReactNode;
}

/** 表单字段壳：统一标签、说明、错误信息及控件的无障碍关联。 */
export function FormField({
  id,
  label,
  labelAction,
  description,
  error,
  className,
  children,
}: FormFieldProps) {
  const hasDescription = description !== undefined && description !== null && description !== false;
  const hasError = error !== undefined && error !== null && error !== false;
  const descriptionId = hasDescription ? `${id}-description` : undefined;
  const errorId = hasError ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div data-slot="form-field" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": hasError ? true : undefined,
      })}
      {hasDescription ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
