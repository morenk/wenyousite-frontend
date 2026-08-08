/** 重置密码页面：输入邮箱、验证码、新密码完成重置 */

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import {
  resetPasswordSchema,
  emailSchema,
  type ResetPasswordFormData,
} from "@/lib/validations/auth";
import { useResetPassword, useForgotPassword } from "@/api/hooks/use-auth-actions";
import { API_ERROR_CODE, getApiError } from "@/api/errors";
import { useEmailCode } from "@/hooks/use-email-code";
import { SendCodeButton } from "@/components/auth/send-code-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const resetMutation = useResetPassword();
  const forgotMutation = useForgotPassword();
  const { countdown, sending, send } = useEmailCode();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const handleSend = async () => {
    const parsed = emailSchema.safeParse({ email: getValues("email") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    try {
      await send(async () => {
        await forgotMutation.mutateAsync({ email: parsed.data.email });
        toast.success("验证码已发送，请查收邮箱");
      });
    } catch (err) {
      const e = getApiError(err);
      toast.error(
        e.code === API_ERROR_CODE.RATE_LIMITED
          ? "操作太频繁，请稍后再试"
          : e.message || "发送失败，请稍后重试",
      );
    }
  };

  const onSubmit = async (formData: ResetPasswordFormData) => {
    try {
      await resetMutation.mutateAsync({
        email: formData.email,
        token: formData.token,
        newPassword: formData.newPassword,
      });

      toast.success("密码重置成功，请重新登录");
      logout();
      router.push("/login");
    } catch (error: unknown) {
      const err = getApiError(error);
      if (err.code === API_ERROR_CODE.BAD_REQUEST) {
        toast.error(err.message || "验证码错误或已过期");
      } else if (err.code === API_ERROR_CODE.RATE_LIMITED) {
        toast.error("操作太频繁，请稍后再试");
      } else {
        toast.error(err.message || "重置失败，请稍后重试");
      }
    }
  };

  return (
    <AuthPageShell
      title="重置密码"
      description="输入邮箱、收到的验证码和新的密码"
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  autoComplete="email"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="token">验证码</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="token"
                    placeholder="6 位数字"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    {...register("token")}
                  />
                  <SendCodeButton
                    countdown={countdown}
                    sending={sending}
                    sent={false}
                    onSend={handleSend}
                    initialLabel="发送验证码"
                    className="shrink-0"
                  />
                </div>
                {errors.token && (
                  <p className="text-xs text-destructive">
                    {errors.token.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPassword">新密码</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="至少 8 位，含字母和数字"
                  autoComplete="new-password"
                  {...register("newPassword")}
                />
                {errors.newPassword && (
                  <p className="text-xs text-destructive">
                    {errors.newPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? "重置中..." : "重置密码"}
              </Button>
      </form>
    </AuthPageShell>
  );
}
