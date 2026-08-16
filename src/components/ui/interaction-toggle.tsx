"use client";

import {
  ICON_CONTROL_STATES,
  type IconControlTone,
  type IconVisualVariant,
} from "@wenyousite/foundation/icons";
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
  default: "text-foreground",
  like: "text-foreground",
  bookmark: "text-foreground",
  subscription: "text-foreground",
};

const selectedIconClassNames: Record<IconControlTone, string | undefined> = {
  default: "text-accent-foreground",
  like: "text-like",
  bookmark: "text-bookmark",
  subscription: "text-brand-strong",
};

const selectedPendingIconClassNames: Record<IconControlTone, string | undefined> = {
  default: "text-accent-foreground",
  like: "text-like",
  bookmark: "text-bookmark",
  subscription: "text-brand-strong",
};

const selectedIconVariants = Object.fromEntries(
  Object.entries(ICON_CONTROL_STATES.selected).map(([tone, state]) => [
    tone,
    state.glyph === "filled" ? "filled" : "outline",
  ]),
) as unknown as Record<IconControlTone, IconVisualVariant>;

/** Foundation 驱动的二态互动按钮；常驻选中态只改变图标本身。 */
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
        "group/interaction-toggle bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground active:translate-y-0 disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-[var(--icon-control-disabled-content-opacity)] aria-disabled:cursor-wait",
        className,
        pressed && selectedToneClassNames[tone],
      )}
      {...props}
    >
      <span data-slot="interaction-toggle-icon-target">
        <WenyouIcon
          id={pending ? "status.loading" : icon}
          variant={pending ? "outline" : pressed ? selectedIconVariants[tone] : "outline"}
          data-slot="interaction-toggle-icon"
          className={cn(
            "transition-[color,fill] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
            pending && "animate-spin motion-reduce:animate-none",
            pressed && (pending ? selectedPendingIconClassNames[tone] : selectedIconClassNames[tone]),
            iconClassName,
          )}
        />
      </span>
      {children}
      {accessibleDescription ? (
        <span id={descriptionId} className="sr-only">
          {accessibleDescription}
        </span>
      ) : null}
    </Button>
  );
}
