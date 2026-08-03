/** 更换邮箱表单：当前密码二次认证 → 新邮箱 → 验证码确认 → 成功态 */

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  useChangeEmailRequest,
  useChangeEmailVerify,
} from "@/api/hooks/use-auth-actions";
import {
  changeEmailSchema,
  emailSchema,
  type ChangeEmailFormData,
} from "@/lib/validations/auth";
import { useCountdown } from "@/hooks/use-countdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export function ChangeEmailForm() {
  const queryClient = useQueryClient();
  const changeEmailRequest = useChangeEmailRequest();
  const changeEmailVerify = useChangeEmailVerify();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ChangeEmailFormData>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { oldPassword: "", newEmail: "", code: "" },
  });
  const emailCountdown = useCountdown(60);
  const [codeSent, setCodeSent] = useState(false);
  const [done, setDone] = useState(false);

  const handleSendCode = async () => {
    const newEmail = getValues("newEmail").trim();
    const parsed = emailSchema.safeParse({ email: newEmail });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    try {
      await changeEmailRequest.mutateAsync({
        newEmail: parsed.data.email,
        oldPassword: getValues("oldPassword"),
      });
      setCodeSent(true);
      emailCountdown.start();
      toast.success("验证码已发送至新邮箱");
    } catch (err) {
      const e = err as { code?: number; message?: string };
      if (e.code === 40900) {
        toast.error("该邮箱已被其他用户使用");
      } else {
        toast.error(e.message || "发送失败，请稍后重试");
      }
    }
  };

  const onSubmit = async (values: ChangeEmailFormData) => {
    try {
      await changeEmailVerify.mutateAsync({
        newEmail: values.newEmail.trim(),
        code: values.code,
      });
      toast.success("邮箱已更换");
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setDone(true);
    } catch (err) {
      const e = err as { code?: number; message?: string };
      if (e.code === 40001) {
        toast.error(e.message || "验证码错误或已过期");
      } else {
        toast.error(e.message || "更换失败，请稍后重试");
      }
    }
  };

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm font-semibold text-foreground">邮箱已更换</p>
        <p className="mt-1 text-xs text-muted-foreground">你的新邮箱已生效</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="change-old-password">当前密码</Label>
        <PasswordInput
          id="change-old-password"
          autoComplete="current-password"
          placeholder="输入当前密码以验证身份"
          {...register("oldPassword")}
        />
        {errors.oldPassword && (
          <p className="text-xs text-destructive">{errors.oldPassword.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-email">新邮箱</Label>
        <Input
          id="new-email"
          type="email"
          autoComplete="email"
          placeholder="输入新邮箱地址"
          {...register("newEmail")}
        />
        {errors.newEmail && (
          <p className="text-xs text-destructive">{errors.newEmail.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email-code">验证码</Label>
        <div className="flex items-center gap-2">
          <Input
            id="email-code"
            inputMode="numeric"
            maxLength={6}
            placeholder="6 位数字"
            disabled={!codeSent}
            {...register("code")}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={handleSendCode}
            disabled={changeEmailRequest.isPending || emailCountdown.countdown > 0}
          >
            {changeEmailRequest.isPending
              ? "发送中..."
              : emailCountdown.countdown > 0
                ? `${emailCountdown.countdown} 秒后重发`
                : codeSent
                  ? "重新发送"
                  : "发送验证码"}
          </Button>
        </div>
        {errors.code && (
          <p className="text-xs text-destructive">{errors.code.message}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={changeEmailVerify.isPending || !codeSent}>
          {changeEmailVerify.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : null}
          确认更换
        </Button>
      </div>
    </form>
  );
}
