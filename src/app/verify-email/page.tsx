/** 邮箱验证页面：输入验证码验证邮箱 */

"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import {
  verifyEmailSchema,
  type VerifyEmailFormData,
} from "@/lib/validations/auth";
import {
  useVerifyEmail,
  useResendVerification,
} from "@/api/hooks/use-auth-actions";
import { API_ERROR_CODE, getApiError } from "@/api/errors";
import { useEmailCode } from "@/hooks/use-email-code";
import { SendCodeButton } from "@/components/auth/send-code-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user } = useAuth();
  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendVerification();
  const { countdown, sending, send } = useEmailCode();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyEmailFormData>({
    resolver: zodResolver(verifyEmailSchema),
  });

  const onSubmit = async (formData: VerifyEmailFormData) => {
    try {
      await verifyMutation.mutateAsync(formData.token);
      toast.success("邮箱验证成功");
      router.replace("/");
    } catch (error: unknown) {
      const err = getApiError(error);
      if (err.code === API_ERROR_CODE.BAD_REQUEST) {
        toast.error(err.message || "验证码错误或已过期");
      } else {
        toast.error(err.message || "验证失败，请稍后重试");
      }
    }
  };

  const handleSend = async () => {
    if (!user?.email) {
      toast.error("无法获取邮箱信息");
      return;
    }
    try {
      await send(async () => {
        await resendMutation.mutateAsync(user.email);
        toast.success("验证码已发送");
      });
    } catch {
      toast.error("发送失败，请稍后重试");
    }
  };

  if (!user) return null;

  return (
    <AuthPageShell title="验证邮箱" description={`已发送验证码至 ${user.email}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="token">验证码</Label>
                <Input
                  id="token"
                  placeholder="6 位数字"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  {...register("token")}
                />
                {errors.token && (
                  <p className="text-xs text-destructive">
                    {errors.token.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? "验证中..." : "验证"}
              </Button>

              <SendCodeButton
                countdown={countdown}
                sending={sending}
                sent={false}
                onSend={handleSend}
                initialLabel="发送验证码"
                className="w-full"
              />
      </form>
    </AuthPageShell>
  );
}
