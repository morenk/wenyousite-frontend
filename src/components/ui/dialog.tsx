"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { buttonVariants } from "@/components/ui/button";
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
        "fixed inset-0 z-[80] bg-foreground/40 backdrop-blur-[1px]",
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
        "fixed inset-0 z-[81] flex items-center justify-center overflow-y-auto p-4 sm:p-6",
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
      className={cn("font-display text-lg font-bold text-foreground", className)}
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
      className={cn("text-sm leading-6 text-muted-foreground", className)}
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
  label = "关闭",
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
      <X />
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
