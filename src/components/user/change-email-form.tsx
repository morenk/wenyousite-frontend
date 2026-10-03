/** 更换邮箱表单：当前密码二次认证 → 新邮箱 → 验证码确认 → 成功后重新登录并返回账号安全 */

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  useChangeEmailRequest,
  useChangeEmailVerify,
} from "@/api/hooks/use-auth-actions";
import { getApiError } from "@/api/errors";
import { useAuth } from "@/lib/auth";
import { buildLoginHref } from "@/lib/login-redirect";
import {
  changeEmailSchema,
  emailSchema,
  type ChangeEmailFormData,
} from "@/lib/validations/auth";
import {
  EMAIL_SEND_UNCERTAIN_MESSAGE,
  isEmailSendOutcomeUnknown,
  useEmailCode,
} from "@/hooks/use-email-code";
import { SendCodeButton } from "@/components/auth/send-code-button";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useSettingsLeaveGuard } from "./use-settings-leave-guard";

export function ChangeEmailForm() {
  const { logout } = useAuth();
  const changeEmailRequest = useChangeEmailRequest();
  const changeEmailVerify = useChangeEmailVerify();
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    clearErrors,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ChangeEmailFormData>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { oldPassword: "", newEmail: "", code: "" },
  });
  const { countdown, sending, send } = useEmailCode();
  const [codeSent, setCodeSent] = useState(false);

  const busy = sending || changeEmailVerify.isPending || isSubmitting;
  useSettingsLeaveGuard(isDirty, busy);

  const handleSendCode = async () => {
    if (busy) return;
    clearErrors();
    const newEmail = getValues("newEmail").trim();
    const parsed = emailSchema.safeParse({ email: newEmail });
    if (!parsed.success) {
      setError("newEmail", { message: parsed.error.issues[0].message });
      return;
    }
    try {
      await send(async () => {
        await changeEmailRequest.mutateAsync({
          newEmail: parsed.data.email,
          oldPassword: getValues("oldPassword"),
        });
        setCodeSent(true);
        toast.success("验证码已发送至新邮箱");
      });
    } catch (err) {
      const e = getApiError(err);
      if (e.code === 40900 || e.code === 40901) {
        setError("newEmail", { message: "该邮箱已被其他用户使用" });
      } else if (e.code === 40116) {
        setError("oldPassword", { message: e.message || "当前密码错误" });
      } else if (e.code === 42900 || e.status === 429) {
        setCodeSent(true);
        toast.warning("操作太频繁，请先检查邮箱或 60 秒后再试");
      } else if (isEmailSendOutcomeUnknown(err)) {
        setCodeSent(true);
        toast.warning(EMAIL_SEND_UNCERTAIN_MESSAGE);
      } else {
        setError("root", { message: e.message || "发送失败，请稍后重试" });
      }
    }
  };

  const onSubmit = async (values: ChangeEmailFormData) => {
    if (sending || changeEmailVerify.isPending) return;
    clearErrors();
    try {
      await changeEmailVerify.mutateAsync({
        newEmail: values.newEmail.trim(),
        code: values.code,
      });
      toast.success("邮箱已更换，请重新登录");
      logout({ redirectTo: buildLoginHref("/me#security") });
    } catch (err) {
      const e = getApiError(err);
      // 已提交契约：40111–40114 分别为过期、错误、次数超限与缺少记录。
      if (e.code === 40001 || (e.code !== undefined && [40111, 40112, 40113, 40114].includes(e.code))) {
        setError("code", { message: e.message || "验证码错误或已过期" });
      } else if (e.code === 40900 || e.code === 40901) {
        setError("newEmail", { message: e.message || "该邮箱已被其他用户使用" });
      } else {
        setError("root", { message: e.message || "更换失败，请稍后重试" });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField id="change-old-password" label="当前密码" error={errors.oldPassword?.message}>
        {(controlProps) => (
          <PasswordInput
            {...controlProps}
            disabled={busy}
            autoComplete="current-password"
            placeholder="输入当前密码以验证身份"
            {...register("oldPassword")}
          />
        )}
      </FormField>

      <FormField id="new-email" label="新邮箱" error={errors.newEmail?.message}>
        {(controlProps) => (
          <Input
            {...controlProps}
            disabled={busy}
            type="email"
            autoComplete="email"
            placeholder="输入新邮箱地址"
            {...register("newEmail")}
          />
        )}
      </FormField>

      <FormField id="email-code" label="验证码" error={errors.code?.message}>
        {(controlProps) => (
          <div className="flex items-center gap-2">
            <Input
              {...controlProps}
              inputMode="numeric"
              maxLength={6}
              placeholder="6 位数字"
              disabled={!codeSent || busy}
              {...register("code")}
            />
            <SendCodeButton
              countdown={countdown}
              sending={sending}
              sent={codeSent}
              disabled={busy}
              onSend={handleSendCode}
              className="shrink-0"
            />
          </div>
        )}
      </FormField>

      {errors.root ? <p role="alert" className="text-sm text-destructive">{errors.root.message}</p> : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!codeSent || busy}
          pending={changeEmailVerify.isPending || isSubmitting}
          pendingLabel="更换中…"
        >
          确认更换
        </Button>
      </div>
    </form>
  );
}
