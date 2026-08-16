"use client";

import type { IconControlTone } from "@wenyousite/foundation/icons";
import { useId, type ComponentProps, type MouseEventHandler, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { WenyouIcon, type WenyouIconId } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";

type InteractionToggleProps = Omit<
  ComponentProps<typeof Button>,
  | "aria-busy"
  | "aria-describedby"
  | "aria-disabled"
  | "aria-label"
  | "aria-pressed"
  | "children"
  | "disabled"
  | "onClick"
  | "title"
  | "type"
> & {
  tone?: IconControlTone;
  pressed: boolean;
  pending?: boolean;
  disabled?: boolean;
  icon: WenyouIconId;
  accessibleName: string;
  accessibleDescription?: string;
  actionTitle?: string;
  iconClassName?: string;
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const selectedToneClassNames: Record<IconControlTone, string> = {
  default: "bg-accent text-accent-foreground",
  like: "bg-like-soft text-foreground",
  bookmark: "bg-bookmark-soft text-foreground",
};

const selectedIconClassNames: Record<IconControlTone, string | undefined> = {
  default: undefined,
  like: "fill-like text-like",
  bookmark: "fill-bookmark text-bookmark",
};

const selectedPendingIconClassNames: Record<IconControlTone, string | undefined> = {
  default: undefined,
  like: "text-like",
  bookmark: "text-bookmark",
};

/** Foundation 驱动的二态互动按钮；鲜粉与金色只作用于状态图标。 */
export function InteractionToggle({
  tone = "default",
  pressed,
  pending = false,
  disabled = false,
  icon,
  accessibleName,
  accessibleDescription,
  actionTitle,
  iconClassName,
  children,
  onClick,
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: InteractionToggleProps) {
  const descriptionId = useId();
  const unavailable = disabled || pending;
  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (unavailable) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      aria-disabled={unavailable || undefined}
      aria-busy={pending || undefined}
      aria-pressed={pressed}
      aria-label={accessibleName}
      aria-describedby={accessibleDescription ? descriptionId : undefined}
      title={actionTitle}
      data-interaction-tone={tone}
      onClick={handleClick}
      className={cn(
        "group/interaction-toggle text-muted-foreground aria-disabled:cursor-wait disabled:bg-transparent disabled:opacity-[var(--icon-control-disabled-content-opacity)]",
        className,
        pressed && selectedToneClassNames[tone],
      )}
      {...props}
    >
      <WenyouIcon
        id={pending ? "status.loading" : icon}
        data-slot="interaction-toggle-icon"
        className={cn(
          "transition-[color,fill,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)] motion-safe:group-active/interaction-toggle:scale-90",
          pending && "animate-spin motion-reduce:animate-none",
          pressed && (pending ? selectedPendingIconClassNames[tone] : selectedIconClassNames[tone]),
          iconClassName,
        )}
      />
      {children}
      {accessibleDescription ? (
        <span id={descriptionId} className="sr-only">
          {accessibleDescription}
        </span>
      ) : null}
    </Button>
  );
}
