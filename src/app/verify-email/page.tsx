/** 邮箱验证页面：输入验证码验证邮箱 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  verifyEmailSchema,
  type VerifyEmailFormData,
} from "@/lib/validations/auth";
import {
  useVerifyEmail,
  useResendVerification,
} from "@/api/hooks/use-auth-actions";
import { useEmailCode } from "@/hooks/use-email-code";
import { SendCodeButton } from "@/components/auth/send-code-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuth();
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

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, router, isInitialized]);

  const onSubmit = async (formData: VerifyEmailFormData) => {
    try {
      await verifyMutation.mutateAsync(formData.token);
      toast.success("邮箱验证成功");
      router.replace("/");
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 40001) {
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

  if (!isInitialized) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">验证邮箱</CardTitle>
            <CardDescription className="text-center">
              已发送验证码至 {user.email}
            </CardDescription>
          </CardHeader>

          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
