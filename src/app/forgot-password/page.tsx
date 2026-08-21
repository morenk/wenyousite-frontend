/** 忘记密码页面：输入邮箱请求重置邮件 */

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "@/lib/validations/auth";
import { useForgotPassword } from "@/api/hooks/use-auth-actions";
import { API_ERROR_CODE, getApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import {
  EMAIL_SEND_UNCERTAIN_MESSAGE,
  isEmailSendOutcomeUnknown,
  useEmailCode,
} from "@/hooks/use-email-code";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const forgotMutation = useForgotPassword();
  const { countdown, sending, send } = useEmailCode();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (formData: ForgotPasswordFormData) => {
    try {
      await send(() => forgotMutation.mutateAsync({ email: formData.email }));
      toast.success("重置邮件已发送，请查收邮箱");
      setValue("email", formData.email);
      router.push("/reset-password");
    } catch (error: unknown) {
      const err = getApiError(error);
      if (err.code === API_ERROR_CODE.RATE_LIMITED || err.status === 429) {
        toast.warning("操作太频繁，请先检查邮箱或 60 秒后再试");
        router.push("/reset-password");
      } else if (isEmailSendOutcomeUnknown(error)) {
        toast.warning(EMAIL_SEND_UNCERTAIN_MESSAGE);
        router.push("/reset-password");
      } else {
        toast.error(err.message || "发送失败，请稍后重试");
      }
    }
  };

  return (
    <AuthPageShell
      title="忘记密码"
      description="输入注册邮箱，我们将发送重置验证码"
      footer={(
        <p className="text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-brand-strong hover:underline underline-offset-2"
          >
            返回登录
          </Link>
        </p>
      )}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField id="email" label="邮箱" error={errors.email?.message}>
          {(controlProps) => (
                <Input
                  {...controlProps}
                  type="email"
                  placeholder="your@email.com"
                  autoComplete="email"
                  {...register("email")}
                />
          )}
        </FormField>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={countdown > 0}
          pending={sending}
          pendingLabel="发送中..."
        >
          {countdown > 0 ? `${countdown} 秒后可重试` : "发送重置验证码"}
        </Button>
      </form>
    </AuthPageShell>
  );
}
