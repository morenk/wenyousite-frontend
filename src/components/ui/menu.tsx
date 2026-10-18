"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Density = "default" | "rich" | "comfortable";
const densityClass = { default: "min-h-10", rich: "min-h-11", comfortable: "min-h-12" };
const itemClass = "flex w-full min-w-0 cursor-default items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:text-muted-foreground";

function MenuTrigger({ tooltip, ...props }: MenuPrimitive.Trigger.Props & { tooltip?: string }) {
  const trigger = <MenuPrimitive.Trigger {...props} />;
  return tooltip ? <Tooltip content={tooltip}>{trigger}</Tooltip> : trigger;
}

function MenuContent({ className, side = "bottom", align = "end", sideOffset = 4, anchor, ...props }:
  Omit<MenuPrimitive.Popup.Props, "className"> & { className?: string } &
  Pick<MenuPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "anchor">) {
  return <MenuPrimitive.Portal>
    <MenuPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} anchor={anchor} className="z-[var(--layer-popup)]">
      <MenuPrimitive.Popup data-slot="menu-content" className={cn(
        "w-48 max-h-(--available-height) origin-(--transform-origin) overflow-y-auto rounded-[var(--radius-panel)] border border-border bg-popover p-1 text-popover-foreground shadow-popover outline-none motion-reduce:animate-none duration-[var(--motion-standard)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className,
      )} {...props} />
    </MenuPrimitive.Positioner>
  </MenuPrimitive.Portal>;
}

function MenuItem({ className, density = "default", destructive = false, ...props }:
  Omit<MenuPrimitive.Item.Props, "className"> & { className?: string; density?: Density; destructive?: boolean }) {
  return <MenuPrimitive.Item data-slot="menu-item" data-destructive={destructive || undefined} className={cn(
    itemClass, densityClass[density], destructive && "text-destructive data-highlighted:bg-destructive-soft data-highlighted:text-destructive", className,
  )} {...props} />;
}

function MenuRadioItem({ className, density = "default", ...props }:
  Omit<MenuPrimitive.RadioItem.Props, "className"> & { className?: string; density?: Density }) {
  return <MenuPrimitive.RadioItem data-slot="menu-radio-item" className={cn(itemClass, densityClass[density], className)} {...props} />;
}

function MenuSeparator({ className, ...props }: Omit<MenuPrimitive.Separator.Props, "className"> & { className?: string }) {
  return <MenuPrimitive.Separator className={cn("mx-2 my-1 h-px bg-border", className)} {...props} />;
}

/** 业务菜单只组合项目和行为；弹层、危险项及禁用样式由共享层维护。 */
export const Menu = {
  Root: MenuPrimitive.Root,
  Trigger: MenuTrigger,
  Content: MenuContent,
  Item: MenuItem,
  Separator: MenuSeparator,
  RadioGroup: MenuPrimitive.RadioGroup,
  RadioItem: MenuRadioItem,
  RadioItemIndicator: MenuPrimitive.RadioItemIndicator,
};
