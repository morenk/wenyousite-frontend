"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Fuel } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useTipWenyou, type TipTarget } from "@/api/hooks/use-economy";
import { getApiErrorMessage } from "@/api/errors";
import { useAuth } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLoginRedirect } from "@/hooks/use-login-redirect";

const tipSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^(?:[2-9]|[1-9]\d+)$/, "最低投入 2 升，且只能填写整数"),
});

type TipForm = z.infer<typeof tipSchema>;

interface WenyouTipButtonProps {
  target: TipTarget;
  recipientName: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon-sm";
  iconOnly?: boolean;
  className?: string;
}

export function WenyouTipButton({
  target,
  recipientName,
  variant = "ghost",
  size = "sm",
  iconOnly = false,
  className,
}: WenyouTipButtonProps) {
  const { user } = useAuth();
  const redirectToLogin = useLoginRedirect();
  const [open, setOpen] = useState(false);
  const requestRef = useRef<{
    amount: string;
    clientRequestId: string;
  } | null>(null);
  const submittingRef = useRef(false);
  const tip = useTipWenyou(target, user?.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TipForm>({
    resolver: zodResolver(tipSchema),
    defaultValues: { amount: "2" },
  });

  const submit = async ({ amount }: TipForm) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const normalized = amount.trim();
    const nextRequest = requestRef.current?.amount === normalized
      ? requestRef.current
      : { amount: normalized, clientRequestId: crypto.randomUUID() };
    requestRef.current = nextRequest;
    try {
      const result = await tip.mutateAsync(nextRequest);
      toast.success(`已加油 ${result.grossAmount} 升`);
      requestRef.current = null;
      reset({ amount: "2" });
      setOpen(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "投入失败，请稍后重试"));
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? "icon-sm" : size}
        className={className}
        onClick={() => {
          if (!user) {
            redirectToLogin();
            return;
          }
          setOpen(true);
        }}
        aria-label="加油"
        title={iconOnly ? "加油" : undefined}
      >
        <Fuel className="h-4 w-4" />
        {!iconOnly && "加油"}
      </Button>
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-[var(--layer-modal-backdrop)] bg-[var(--overlay-scrim)] backdrop-blur-[var(--overlay-scrim-blur)]" />
          <AlertDialog.Viewport className="fixed inset-0 z-[var(--layer-modal)] flex items-center justify-center p-4">
            <AlertDialog.Popup className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-dialog outline-none">
              <AlertDialog.Title className="text-base font-semibold">
                为{recipientName}加油
              </AlertDialog.Title>
              <form
                onSubmit={(event) => void handleSubmit(submit)(event)}
                className="mt-3 space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor={`tip-amount-${target.type}-${target.id}`}>投入升数</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`tip-amount-${target.type}-${target.id}`}
                      inputMode="numeric"
                      autoComplete="off"
                      aria-invalid={!!errors.amount}
                      {...register("amount")}
                    />
                    <span className="shrink-0 text-sm text-muted-foreground">升</span>
                  </div>
                  {errors.amount && (
                    <p className="text-xs text-destructive">{errors.amount.message}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <AlertDialog.Close
                    className={buttonVariants({ variant: "ghost" })}
                    disabled={tip.isPending}
                  >
                    取消
                  </AlertDialog.Close>
                  <Button
                    type="submit"
                    pending={tip.isPending}
                    pendingLabel="正在加油…"
                  >
                    确认加油
                  </Button>
                </div>
              </form>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
