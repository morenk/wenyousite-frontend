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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const forgotMutation = useForgotPassword();

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
      await forgotMutation.mutateAsync({ email: formData.email });
      toast.success("重置邮件已发送，请查收邮箱");
      setValue("email", formData.email);
      router.push("/reset-password");
    } catch (error: unknown) {
      const err = getApiError(error);
      if (err.code === API_ERROR_CODE.RATE_LIMITED) {
        toast.error("操作太频繁，请稍后再试");
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
            className="font-medium text-primary hover:underline underline-offset-2"
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

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={forgotMutation.isPending}
              >
                {forgotMutation.isPending ? "发送中..." : "发送重置验证码"}
              </Button>
      </form>
    </AuthPageShell>
  );
}
