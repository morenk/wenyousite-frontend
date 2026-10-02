"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogBackdrop, DialogCloseButton, DialogDescription, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/api/errors";

const schema = z.object({ number: z.string().regex(/^[1-9]\d*$/, "请输入正整数编号").refine((value) => Number.isSafeInteger(Number(value)), "编号过大") });

interface DiscussionJumpProps {
  subject: "楼层" | "回复";
  current?: number;
  maxNumber: number;
  total: number;
  compact?: boolean;
  onOpen?: () => void;
  onJump: (number: number, signal?: AbortSignal) => Promise<void>;
}

/** 入口与定位表单共用一份组件；打开时不唤起软键盘。 */
export function DiscussionJump({ subject, current, maxNumber, total, compact = false, onJump, onOpen }: DiscussionJumpProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const id = useId();
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => { request.current?.abort(); }, []);
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { number: "" } });
  const submit = async ({ number }: z.infer<typeof schema>) => {
    if (Number(number) > maxNumber) {
      setError("number", { message: `编号不能超过 ${maxNumber}` });
      return;
    }
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setSubmitting(true);
    try {
      await onJump(Number(number), controller.signal);
      if (request.current === controller && !controller.signal.aborted) setOpen(false);
    } catch (error) {
      if (request.current !== controller || controller.signal.aborted) return;
      setError("number", { message: getApiErrorMessage(error, `未找到该${subject}，请检查编号后重试`) });
    } finally {
      if (request.current === controller) { request.current = undefined; setSubmitting(false); }
    }
  };
  return <>
    <Button variant="ghost" size="sm" disabled={maxNumber < 1} aria-label={`跳转到${subject}`} aria-haspopup="dialog" onClick={() => { onOpen?.(); request.current?.abort(); request.current = undefined; setSubmitting(false); reset(); setOpen(true); }} className="shrink-0 rounded-[var(--radius-control)] tabular-nums">
      {compact ? (current ? `#${current}` : "定位") : `共 ${total.toLocaleString()} ${subject === "楼层" ? "层" : "条回复"}`}
      <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
    </Button>
    <Dialog open={open} onOpenChange={(value) => { if (!value) { request.current?.abort(); request.current = undefined; setSubmitting(false); } setOpen(value); }}>
      <DialogPortal><DialogBackdrop /><DialogViewport className="items-end p-0 sm:items-center sm:p-6">
        <DialogPopup initialFocus={false} className="max-w-sm rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-b-[var(--radius-panel)]">
          <div className="flex items-center justify-between gap-3"><DialogTitle>跳转到{subject}</DialogTitle><DialogCloseButton /></div>
          <DialogDescription className="mt-1 tabular-nums">{current ? `当前 #${current} · ` : ""}编号至 #{maxNumber}</DialogDescription>
          <form onSubmit={(event) => void handleSubmit(submit)(event)} className="mt-5" noValidate>
            <label htmlFor={id} className="sr-only">{subject}编号</label>
            <div className="flex items-start gap-2"><Input {...register("number")} id={id} inputMode="numeric" autoComplete="off" placeholder="输入编号" aria-invalid={Boolean(errors.number)} aria-describedby={errors.number ? `${id}-error` : undefined} disabled={isSubmitting} /><Button type="submit" pending={isSubmitting} disabled={isSubmitting}>前往</Button></div>
            {errors.number ? <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-destructive">{errors.number.message}</p> : null}
          </form>
        </DialogPopup>
      </DialogViewport></DialogPortal>
    </Dialog>
  </>;
}
