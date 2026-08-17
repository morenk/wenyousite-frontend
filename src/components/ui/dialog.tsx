"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { LANGUAGE_ACTIONS } from "@wenyousite/foundation/language";
import type { ComponentProps } from "react";

import { buttonVariants } from "@/components/ui/button";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;

function DialogBackdrop({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "fixed inset-0 z-[var(--layer-modal-backdrop)] bg-[var(--overlay-scrim)] backdrop-blur-[var(--overlay-scrim-blur)]",
        className,
      )}
      {...props}
    />
  );
}

function DialogViewport({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Viewport>) {
  return (
    <DialogPrimitive.Viewport
      data-slot="dialog-viewport"
      className={cn(
        "fixed inset-0 z-[var(--layer-modal)] flex items-center justify-center overflow-y-auto p-4 sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

function DialogPopup({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Popup>) {
  return (
    <DialogPrimitive.Popup
      data-slot="dialog-popup"
      className={cn(
        "max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-2xl border border-border bg-card text-card-foreground shadow-dialog outline-none",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-semibold text-foreground [font-size:var(--type-subsection-title-size)] [line-height:var(--type-subsection-title-line-height)]", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground [font-size:var(--type-compact-body-size)] [line-height:var(--type-compact-body-line-height)]", className)}
      {...props}
    />
  );
}

function DialogClose({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={cn(className)}
      {...props}
    />
  );
}

function DialogCloseButton({
  label = LANGUAGE_ACTIONS.close,
  className,
  ...props
}: Omit<ComponentProps<typeof DialogPrimitive.Close>, "aria-label" | "children"> & {
  label?: string;
}) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close-button"
      aria-label={label}
      title={label}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-compact" }),
        className,
      )}
      {...props}
    >
      <WenyouIcon id="action.close" />
    </DialogPrimitive.Close>
  );
}

function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex items-center justify-end gap-2", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
};
