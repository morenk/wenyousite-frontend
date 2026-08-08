"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Gift, Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
      toast.success(
        `已投入 ${result.grossAmount} 升温油，对方到账 ${result.recipientAmount} 升`,
      );
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
            if (typeof window !== "undefined") {
              const next = `${window.location.pathname}${window.location.search}`;
              window.location.assign(`/login?next=${encodeURIComponent(next)}`);
            }
            return;
          }
          setOpen(true);
        }}
        aria-label="加油"
        title={iconOnly ? "加油（投入温油）" : undefined}
      >
        <Gift className="h-4 w-4" />
        {!iconOnly && "加油"}
      </Button>
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[1px]" />
          <AlertDialog.Viewport className="fixed inset-0 z-[81] flex items-center justify-center p-4">
            <AlertDialog.Popup className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl outline-none">
              <AlertDialog.Title className="text-base font-semibold">
                为{recipientName}加油
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                最低 2 升；创作者到账 85%（向下取整），其余由平台保留。
              </AlertDialog.Description>
              <form
                onSubmit={(event) => void handleSubmit(submit)(event)}
                className="mt-4 space-y-4"
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
                  <button
                    type="submit"
                    className={cn(buttonVariants())}
                    disabled={tip.isPending}
                  >
                    {tip.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    确认加油
                  </button>
                </div>
              </form>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
