"use client";

import {
  useId,
  useRef,
  useState,
  type MouseEventHandler,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { StackList } from "@/components/ui/stack-list";
import { WenyouIcon } from "@/components/ui/wenyou-icon";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogCloseButton,
  DialogFooter,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useSettingsLeaveGuard } from "@/components/user/use-settings-leave-guard";
import { cn } from "@/lib/utils";

export function SettingsGroup({
  id,
  title,
  children,
}: {
  id?: string;
  title?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      id={id}
      aria-labelledby={title ? titleId : undefined}
      className="scroll-mt-6"
    >
      {title ? (
        <h2
          id={titleId}
          className="mb-2.5 px-5 text-sm font-semibold text-muted-foreground"
        >
          {title}
        </h2>
      ) : null}
      <StackList className="divide-y-0 border-0">{children}</StackList>
    </section>
  );
}

export function SettingsRow({
  id,
  label,
  value,
  href,
  onClick,
  destructive = false,
}: {
  id?: string;
  label: string;
  value?: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  destructive?: boolean;
}) {
  const valueId = useId();
  const className = cn(
    buttonVariants({ variant: "ghost" }),
    "settings-row grid h-auto min-h-16 w-full grid-cols-[minmax(7rem,1fr)_minmax(0,2fr)_auto] gap-5 rounded-[inherit] border-0 px-5 py-4 text-left text-base font-normal whitespace-normal hover:bg-muted/50 active:not-aria-[haspopup]:translate-y-0",
    destructive && "text-destructive",
  );
  const content = (
    <>
      <span>{label}</span>
      <span
        id={valueId}
        className="min-w-0 text-right text-sm font-normal text-muted-foreground"
      >
        {value}
      </span>
      <WenyouIcon
        id="navigation.next"
        className="size-4 text-muted-foreground"
      />
    </>
  );
  return (
    <div
      id={id}
      data-slot="settings-row"
      className="relative scroll-mt-6 first:rounded-t-[var(--radius-card)] last:rounded-b-[var(--radius-card)] after:pointer-events-none after:absolute after:inset-x-5 after:bottom-0 after:border-b after:border-border after:content-[''] last:after:hidden"
    >
      {href ? (
        <Link
          href={href}
          aria-label={label}
          aria-describedby={value ? valueId : undefined}
          className={className}
        >
          {content}
        </Link>
      ) : (
        <Button
          type="button"
          aria-label={label}
          aria-describedby={value ? valueId : undefined}
          aria-haspopup="dialog"
          variant="ghost"
          onClick={onClick}
          className={className}
        >
          {content}
        </Button>
      )}
    </div>
  );
}

export function SettingsSaveFooter({
  busy,
  disabled,
}: {
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <DialogFooter className="mt-6">
      <DialogClose
        disabled={busy}
        className={buttonVariants({ variant: "outline" })}
      >
        取消
      </DialogClose>
      <Button
        type="submit"
        pending={busy}
        disabled={disabled}
        pendingLabel="保存中"
      >
        保存
      </Button>
    </DialogFooter>
  );
}

export interface SettingsDialogProps {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
  dirty?: boolean;
  busy?: boolean;
  wide?: boolean;
}

export function SettingsDialog({
  title,
  children,
  onClose,
  returnFocus,
  dirty = false,
  busy = false,
  wide = false,
}: SettingsDialogProps) {
  const [open, setOpen] = useState(true);
  const asking = useRef(false);
  const confirm = useConfirm();
  useSettingsLeaveGuard(dirty, busy);
  const requestClose = async () => {
    if (busy || asking.current) return;
    asking.current = true;
    const accepted =
      !dirty ||
      (await confirm({
        title: "放弃未保存修改",
        description: "当前修改尚未保存，确定要放弃吗？",
        confirmLabel: "放弃修改",
        cancelLabel: "继续编辑",
        destructive: true,
      }));
    asking.current = false;
    if (accepted) setOpen(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void requestClose();
      }}
      onOpenChangeComplete={(next) => {
        if (!next) onClose?.();
      }}
      disablePointerDismissal={busy}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup
            data-settings-surface
            finalFocus={returnFocus ?? true}
            className={cn("p-6", wide ? "max-w-content" : "max-w-narrow")}
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <DialogTitle>{title}</DialogTitle>
              <DialogCloseButton label={`关闭${title}`} disabled={busy} />
            </div>
            {children}
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
